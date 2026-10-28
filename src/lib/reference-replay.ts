import { prisma } from "@/lib/prisma";
import { parseReasons } from "@/lib/winner-replay";
import { MIN_TIMES_SEEN, calculateRisingScore } from "@/lib/reference-radar";
import { readRankHistory } from "@/lib/viral-analysis";
import { REFERENCE_REPLAY_MODE } from "@/lib/viral-intent-modes";
import { SHORTS_SOURCE } from "@/lib/youtube/shorts-service";

// Stored in a ref_replay draft's qualityReasons so the same outside post is not rewritten twice.
export const REFERENCE_REPLAY_SOURCE_PREFIX = "ref_replay_source:";
export const ATTEMPT_COOLDOWN_DAYS = 7;

const SOURCE_WINDOW_DAYS = 7;
const USED_TAG_WINDOW_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface ReferenceCandidate {
  id: string;
  // The same outside post is stored once per keyword (source "keyword:<kw>"), so rows are grouped by this key.
  sourceKey: string;
  content: string;
  authorUsername: string | null;
  publishedAt: Date | null;
  rawMetrics: string;
}

function parseMetrics(raw: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/**
 * Highest risingScore (referenceScore + rank gain + freshness) among eligible posts; used tags and sources attempted within the cooldown are skipped. Ties go to the newer post.
 * Rows sharing a sourceKey are one post: a used or attempted row blocks all of them, and they are judged together
 * (max timesSeen, max referenceScore, merged rankHistory - not a sum). extraUsedSourceKeys covers used rows that fell out of the candidate window.
 */
export function pickReferenceReplaySource(
  candidates: ReferenceCandidate[],
  usedTags: string[],
  now: Date,
  extraUsedSourceKeys: string[] = []
): ReferenceCandidate | null {
  const used = new Set(usedTags);
  const cooldownStart = now.getTime() - ATTEMPT_COOLDOWN_DAYS * DAY_MS;
  const blockedKeys = new Set(extraUsedSourceKeys);
  const groups = new Map<string, Array<{ candidate: ReferenceCandidate; metrics: Record<string, unknown> }>>();
  for (const candidate of candidates) {
    const metrics = parseMetrics(candidate.rawMetrics);
    const attemptedAt = typeof metrics.replayAttemptedAt === "string" ? Date.parse(metrics.replayAttemptedAt) : NaN;
    if (used.has(`${REFERENCE_REPLAY_SOURCE_PREFIX}${candidate.id}`) || attemptedAt >= cooldownStart) blockedKeys.add(candidate.sourceKey);
    groups.set(candidate.sourceKey, [...(groups.get(candidate.sourceKey) ?? []), { candidate, metrics }]);
  }

  const scored = [...groups].flatMap(([sourceKey, rows]) => {
    if (blockedKeys.has(sourceKey)) return [];
    const scoredRows = rows.flatMap((row) => (typeof row.metrics.referenceScore === "number" ? [{ ...row, score: row.metrics.referenceScore }] : []));
    const maxTimesSeen = Math.max(0, ...rows.map((row) => (typeof row.metrics.timesSeen === "number" ? row.metrics.timesSeen : 0)));
    if (!rows.some((row) => row.metrics.eligibleSource === true) || maxTimesSeen < MIN_TIMES_SEEN || scoredRows.length === 0) return [];
    const best = scoredRows.reduce((top, row) => (row.score > top.score ? row : top));
    // Entries with an invalid `at` are dropped so a blank one can never sort into the "latest" slot that calculateRisingScore reads as the current rank.
    const rankHistory = rows
      .flatMap((row) => readRankHistory(row.metrics))
      .filter((entry) => !Number.isNaN(Date.parse(entry.at)))
      .sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
    const publishedAt = rows.reduce<Date | null>((latest, row) => {
      const at = row.candidate.publishedAt;
      return at && (!latest || at > latest) ? at : latest;
    }, null);
    const score = calculateRisingScore({ referenceScore: best.score, rankHistory, publishedAt, now });
    return [{ candidate: best.candidate, score }];
  });
  scored.sort((a, b) => b.score - a.score || (b.candidate.publishedAt?.getTime() ?? 0) - (a.candidate.publishedAt?.getTime() ?? 0));
  return scored[0]?.candidate ?? null;
}

export async function loadReferenceReplaySource(brandId: string, now: Date): Promise<ReferenceCandidate | null> {
  const [examples, recentReplays] = await Promise.all([
    prisma.viralExample.findMany({
      where: { brandId, source: { not: SHORTS_SOURCE }, publishedAt: { gte: new Date(now.getTime() - SOURCE_WINDOW_DAYS * DAY_MS) } },
      select: { id: true, sourceKey: true, content: true, authorUsername: true, publishedAt: true, rawMetrics: true },
    }),
    prisma.post.findMany({
      where: { brandId, formulaId: REFERENCE_REPLAY_MODE.id, createdAt: { gte: new Date(now.getTime() - USED_TAG_WINDOW_DAYS * DAY_MS) } },
      select: { qualityReasons: true },
    }),
  ]);
  const usedTags = recentReplays.flatMap((post) => parseReasons(post.qualityReasons));
  // Tags hold row ids; a used row may be older than the window, so its sourceKey is looked up to block its sibling rows.
  const usedIds = usedTags.filter((tag) => tag.startsWith(REFERENCE_REPLAY_SOURCE_PREFIX)).map((tag) => tag.slice(REFERENCE_REPLAY_SOURCE_PREFIX.length));
  const usedRows = usedIds.length > 0 ? await prisma.viralExample.findMany({ where: { id: { in: usedIds } }, select: { sourceKey: true } }) : [];
  return pickReferenceReplaySource(examples, usedTags, now, usedRows.map((row) => row.sourceKey));
}

/** Keeps a source whose draft was discarded (e.g. similarity check) from topping the list again the next day. */
export async function markReferenceAttempted(exampleId: string, now: Date): Promise<void> {
  const row = await prisma.viralExample.findUnique({ where: { id: exampleId }, select: { rawMetrics: true } });
  if (!row) return;
  const metrics = { ...parseMetrics(row.rawMetrics), replayAttemptedAt: now.toISOString() };
  await prisma.viralExample.update({ where: { id: exampleId }, data: { rawMetrics: JSON.stringify(metrics) } });
}
