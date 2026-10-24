import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyCronSecret } from "@/lib/cron-auth";
import { checkReadabilityRules } from "@/lib/readability-rules";
import { judgeReadability } from "@/lib/readability-judge";
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

// Re-checks PENDING posts against the readability rules. Preview by default; apply=true archives (never deletes) the failures.
export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const slug = request.nextUrl.searchParams.get("brand")?.trim();
  if (!slug) return NextResponse.json({ error: "brand is required" }, { status: 400 });
  const apply = request.nextUrl.searchParams.get("apply") === "true";

  const brand = await prisma.brand.findUnique({ where: { slug } });
  if (!brand) return NextResponse.json({ error: `Brand not found: ${slug}` }, { status: 404 });
  if (parseBrandConfig(brand.brandConfig).qualityProfile !== "saju_viral") {
    return NextResponse.json({ error: "regate-pending supports saju_viral brands only" }, { status: 400 });
  }

  const pending = await prisma.post.findMany({ where: { brandId: brand.id, status: "PENDING" }, orderBy: { createdAt: "asc" } });
  // Filtered in JS: a SQL NOT startsWith would also drop posts whose formulaId is NULL.
  const posts = pending.filter((post) => !(post.formulaId ?? "").startsWith("video:"));

  const failed: { id: string; reasons: string[] }[] = [];
  const skipped: { id: string; reason: string }[] = [];
  let archived = 0;
  for (const post of posts) {
    const firstComment = post.firstComment ?? "";
    const rules = checkReadabilityRules(post.content, firstComment);
    const reasons = [...rules.reasons];
    if (rules.pass) {
      const verdict = await judgeReadability(post.content, firstComment);
      if (!verdict.readable) reasons.push(`읽힘 판정 실패: ${verdict.reason}`);
    }
    if (reasons.length === 0) continue;
    failed.push({ id: post.id, reasons });
    if (apply) {
      const qualityReasons = [...parseReasons(post.qualityReasons), `regate_readability_failed: ${reasons.join(" / ")}`];
      // The judge loop is slow: the publish cron may have claimed this post since we read it, so only archive while still PENDING.
      const { count } = await prisma.post.updateMany({
        where: { id: post.id, status: "PENDING" },
        data: { status: "ARCHIVED", qualityReasons: JSON.stringify(qualityReasons) },
      });
      if (count === 0) skipped.push({ id: post.id, reason: "no longer PENDING" });
      else archived += count;
    }
  }
  return NextResponse.json({ brand: slug, apply, checked: posts.length, failed, archived, skipped });
}
