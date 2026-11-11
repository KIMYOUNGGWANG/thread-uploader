import type { Brand } from "@prisma/client";
import { ResourceNotFoundError } from "@/lib/brand-access";
import { findTaggedPost, generateReferenceDraft, type ReferenceDraftResult } from "@/lib/manual-reference";
import { prisma } from "@/lib/prisma";
import { MANUAL_X_SOURCE } from "@/lib/reference-replay";
import { readReferenceDecision, splitReferenceContent, type ReferenceDecision } from "@/lib/viral-analysis";
import type { ReferenceKind } from "@/lib/viral-intent-modes";
import { SHORTS_SOURCE } from "@/lib/youtube/shorts-service";

// The same outside post is stored once per keyword, so rows are fetched wide and then collapsed by sourceKey.
const FETCH_WINDOW = 300;
export const DEFAULT_REVIEW_LIMIT = 60;

export interface ReferenceReviewItem {
  id: string;
  authorUsername: string | null;
  permalink: string | null;
  publishedAt: string | null;
  hook: string;
  body: string;
  hookType: string | null;
  emotionalDriver: string | null;
  structureType: string | null;
  ctaType: string | null;
  patternSummary: string | null;
  whyItWorks: string | null;
  referenceScore: number | null;
  timesSeen: number;
  eligibleSource: boolean;
  replayAttemptedAt: string | null;
  decision: ReferenceDecision | null;
}

interface ReviewRow {
  id: string;
  sourceKey: string;
  authorUsername: string | null;
  permalink: string | null;
  publishedAt: Date | null;
  content: string;
  hookType: string | null;
  emotionalDriver: string | null;
  structureType: string | null;
  ctaType: string | null;
  patternSummary: string | null;
  rawMetrics: string;
}

function parseRecord(raw: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(raw || "{}");
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

const readString = (value: unknown) => (typeof value === "string" && value ? value : null);
const readNumber = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : null);

export function toReviewItem(row: ReviewRow): ReferenceReviewItem {
  const raw = parseRecord(row.rawMetrics);
  const { hook, body } = splitReferenceContent(row.content);
  return {
    id: row.id,
    authorUsername: row.authorUsername,
    permalink: row.permalink,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    hook,
    body,
    hookType: row.hookType,
    emotionalDriver: row.emotionalDriver,
    structureType: row.structureType,
    ctaType: row.ctaType,
    patternSummary: row.patternSummary,
    whyItWorks: readString(raw.whyItWorks),
    referenceScore: readNumber(raw.referenceScore),
    timesSeen: readNumber(raw.timesSeen) ?? 0,
    eligibleSource: raw.eligibleSource === true,
    replayAttemptedAt: readString(raw.replayAttemptedAt),
    decision: readReferenceDecision(raw),
  };
}

/** Collapse per-keyword rows of one post into the first (highest viralScore) row, keeping input order. */
export function dedupeBySourceKey<T extends { sourceKey: string }>(rows: T[]): T[] {
  const seen = new Set<string>();
  return rows.filter((row) => (seen.has(row.sourceKey) ? false : (seen.add(row.sourceKey), true)));
}

export async function listReferencesForReview(brandId: string, limit = DEFAULT_REVIEW_LIMIT): Promise<ReferenceReviewItem[]> {
  const rows = await prisma.viralExample.findMany({
    where: { brandId, source: { notIn: [SHORTS_SOURCE, MANUAL_X_SOURCE] } },
    orderBy: [{ viralScore: "desc" }, { discoveredAt: "desc" }],
    take: FETCH_WINDOW,
    select: {
      id: true, sourceKey: true, authorUsername: true, permalink: true, publishedAt: true, content: true,
      hookType: true, emotionalDriver: true, structureType: true, ctaType: true, patternSummary: true, rawMetrics: true,
    },
  });
  return dedupeBySourceKey(rows).slice(0, limit).map(toReviewItem);
}

/** Merge the choice into rawMetrics (null clears it); `{...raw}` keeps every other key. */
export function applyDecision(rawMetrics: string, decision: ReferenceDecision | null): string {
  const next = parseRecord(rawMetrics);
  delete next.referenceDecision;
  if (decision) next.referenceDecision = decision;
  return JSON.stringify(next);
}

/**
 * Stores the choice on the example and on every sibling row of the same post (sourceKey),
 * because ref_replay judges those rows as one post.
 * ponytail: read-then-write per row, so a harvest running at the same moment can overwrite it once; move to a column if that shows up.
 */
export async function setReferenceDecision(brandId: string, exampleId: string, decision: ReferenceDecision | null): Promise<void> {
  const target = await prisma.viralExample.findUnique({ where: { id: exampleId }, select: { brandId: true, sourceKey: true } });
  if (!target || target.brandId !== brandId) throw new ResourceNotFoundError("Reference not found");

  const rows = await prisma.viralExample.findMany({ where: { brandId, sourceKey: target.sourceKey }, select: { id: true, rawMetrics: true } });
  await prisma.$transaction(rows.map((row) => prisma.viralExample.update({
    where: { id: row.id },
    data: { rawMetrics: applyDecision(row.rawMetrics, decision) },
  })));
}

export type CreateDraftFromReferenceResult = ReferenceDraftResult | { status: "duplicate" } | { status: "rejected" };

/**
 * One draft from a collected reference (the card's button). A rejected post is refused, and a post already drafted under any
 * keyword row (same sourceKey) is a duplicate. A dropped draft does not stamp the auto-pick cooldown: a click must not change the cron's choice.
 * ponytail: no server-side lock, so two simultaneous clicks can both pass the duplicate check; the tab allows one run at a time.
 */
export async function createDraftFromReference(brand: Brand, exampleId: string, kind: ReferenceKind, now: Date): Promise<CreateDraftFromReferenceResult> {
  const example = await prisma.viralExample.findUnique({ where: { id: exampleId }, select: { brandId: true, sourceKey: true, content: true, rawMetrics: true } });
  if (!example || example.brandId !== brand.id) throw new ResourceNotFoundError("Reference not found");
  if (readReferenceDecision(example.rawMetrics) === "rejected") return { status: "rejected" };

  const siblings = await prisma.viralExample.findMany({ where: { brandId: brand.id, sourceKey: example.sourceKey }, select: { id: true } });
  const used = await Promise.all(siblings.map((row) => findTaggedPost(brand.id, row.id)));
  if (used.some(Boolean)) return { status: "duplicate" };

  return generateReferenceDraft(brand, { id: exampleId, content: example.content, kind }, { markAttemptedOnDrop: false }, now);
}
