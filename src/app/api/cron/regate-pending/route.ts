import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyCronSecret } from "@/lib/cron-auth";
import { checkReadabilityRules } from "@/lib/readability-rules";
import { judgeReadability } from "@/lib/readability-judge";
import { REFERENCE_REPLAY_MANUAL_TAG } from "@/lib/reference-replay";
import { RANKED_TERM_MODE_IDS } from "@/lib/viral-intent-modes";
import { CONCEPT_FIRST_MODE_IDS, WESTERN_ANCHOR_FORMULA_IDS, findMissingFirstLineConcept, findMissingWesternAnchor } from "@/lib/first-line-rules";
import { englishMaxChars } from "@/lib/domain-registry";
import { threadRootPart } from "@/lib/thread-splitter";
import { parseBrandConfig } from "@/types/brand";

export const maxDuration = 300; // one judge call per pending post, run sequentially

function parseReasons(raw: string): string[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

// Stored first comments get a "📌 ... 리포트:" bridge header and a link line after the gate ran; judge what generation wrote.
function generatedFirstComment(stored: string | null): string {
  return (stored ?? "")
    .split("\n")
    .filter((line) => !line.trim().startsWith("📌") && !/https?:\/\//.test(line))
    .join("\n")
    .trim();
}

// Drafts written before the 2026-11-06 rules: a concept-first mode must name the concept in line 1.
async function sajuDraftProblems(content: string, firstComment: string, formulaId: string, campaignFormulaId: string): Promise<string[]> {
  // Same per-mode allowance generation gives: concept_hierarchy ranks up to 3 terms of one kind.
  const rankedTerms = RANKED_TERM_MODE_IDS.has(formulaId) || RANKED_TERM_MODE_IDS.has(campaignFormulaId);
  const rules = checkReadabilityRules(content, firstComment, { maxJargonTerms: rankedTerms ? 3 : 1 });
  const reasons = [...rules.reasons];
  const missingConcept = CONCEPT_FIRST_MODE_IDS.has(formulaId) ? findMissingFirstLineConcept(content) : null;
  if (missingConcept) reasons.push(missingConcept);
  if (reasons.length === 0) {
    const verdict = await judgeReadability(content, firstComment, { rankedTerms });
    if (!verdict.readable) reasons.push(`읽힘 판정 실패: ${verdict.reason}`);
  }
  return reasons;
}

// The global gates added 2026-11-06 (length cap, no shared A/B ending, Western anchor) only run at generation.
const OPTION_LINE_PATTERN = /^\s*[AB]\)\s/m;
function englishDraftProblems(content: string, formulaId: string): string[] {
  const reasons: string[] = [];
  const max = englishMaxChars(formulaId);
  const length = threadRootPart(content).length;
  if (length > max) reasons.push(`Too long: ${length} > ${max}`);
  if (OPTION_LINE_PATTERN.test(content)) reasons.push("Shared A/B option ending");
  const missingAnchor = WESTERN_ANCHOR_FORMULA_IDS.has(formulaId) ? findMissingWesternAnchor(content) : null;
  if (missingAnchor) reasons.push(missingAnchor);
  return reasons;
}

// Re-checks PENDING posts (or NEEDS_REVIEW with status=NEEDS_REVIEW) against the readability rules.
// Preview by default; apply=true archives (never deletes) the failures. NEEDS_REVIEW counts toward refill's backlog,
// so drafts written under older rules that nobody reviews stall generation (2026-11-04: 13 of 14 backlog slots).
const REGATE_STATUSES = new Set(["PENDING", "NEEDS_REVIEW"]);
export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const slug = request.nextUrl.searchParams.get("brand")?.trim();
  if (!slug) return NextResponse.json({ error: "brand is required" }, { status: 400 });
  const apply = request.nextUrl.searchParams.get("apply") === "true";
  const status = request.nextUrl.searchParams.get("status")?.trim() || "PENDING";
  if (!REGATE_STATUSES.has(status)) return NextResponse.json({ error: "status must be PENDING or NEEDS_REVIEW" }, { status: 400 });

  const brand = await prisma.brand.findUnique({ where: { slug } });
  if (!brand) return NextResponse.json({ error: `Brand not found: ${slug}` }, { status: 404 });
  const qualityProfile = parseBrandConfig(brand.brandConfig).qualityProfile;
  if (qualityProfile !== "saju_viral" && qualityProfile !== "ecommerce_d2c") {
    return NextResponse.json({ error: "regate-pending supports saju_viral and ecommerce_d2c brands only" }, { status: 400 });
  }

  const pending = await prisma.post.findMany({ where: { brandId: brand.id, status }, orderBy: { createdAt: "asc" } });
  // Filtered in JS: a SQL NOT startsWith would also drop posts whose formulaId is NULL.
  const posts = pending.filter((post) => !(post.formulaId ?? "").startsWith("video:"));

  const failed: { id: string; reasons: string[] }[] = [];
  const skipped: { id: string; reason: string }[] = [];
  let archived = 0;
  for (const post of posts) {
    // A draft rewritten from a post the operator pasted by hand waits for that operator; never archive it here.
    if (parseReasons(post.qualityReasons).includes(REFERENCE_REPLAY_MANUAL_TAG)) {
      skipped.push({ id: post.id, reason: "manual reference" });
      continue;
    }
    const reasons = qualityProfile === "ecommerce_d2c"
      ? englishDraftProblems(post.content, post.formulaId ?? "")
      : await sajuDraftProblems(post.content, generatedFirstComment(post.firstComment), post.formulaId ?? "", post.campaignFormulaId ?? "");
    if (reasons.length === 0) continue;
    failed.push({ id: post.id, reasons });
    if (apply) {
      const qualityReasons = [...parseReasons(post.qualityReasons), `regate_readability_failed: ${reasons.join(" / ")}`];
      // The judge loop is slow: the publish cron may have claimed this post since we read it, so only archive while still PENDING.
      const { count } = await prisma.post.updateMany({
        where: { id: post.id, status },
        data: { status: "ARCHIVED", qualityReasons: JSON.stringify(qualityReasons) },
      });
      if (count === 0) skipped.push({ id: post.id, reason: `no longer ${status}` });
      else archived += count;
    }
  }
  return NextResponse.json({ brand: slug, status, apply, checked: posts.length, failed, archived, skipped });
}
