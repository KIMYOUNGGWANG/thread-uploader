import { prisma } from "@/lib/prisma";
import { parseReasons } from "@/lib/winner-replay";
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

/** Highest referenceScore among eligibleSource posts; used tags and sources attempted within the cooldown are skipped. Ties go to the newer post. */
export function pickReferenceReplaySource(
  candidates: ReferenceCandidate[],
  usedTags: string[],
  now: Date
): ReferenceCandidate | null {
  const used = new Set(usedTags);
  const cooldownStart = now.getTime() - ATTEMPT_COOLDOWN_DAYS * DAY_MS;
  const scored = candidates.flatMap((candidate) => {
    if (used.has(`${REFERENCE_REPLAY_SOURCE_PREFIX}${candidate.id}`)) return [];
    const metrics = parseMetrics(candidate.rawMetrics);
    if (metrics.eligibleSource !== true || typeof metrics.referenceScore !== "number") return [];
    const attemptedAt = typeof metrics.replayAttemptedAt === "string" ? Date.parse(metrics.replayAttemptedAt) : NaN;
    if (attemptedAt >= cooldownStart) return [];
    return [{ candidate, score: metrics.referenceScore }];
  });
  scored.sort((a, b) => b.score - a.score || (b.candidate.publishedAt?.getTime() ?? 0) - (a.candidate.publishedAt?.getTime() ?? 0));
  return scored[0]?.candidate ?? null;
}

export async function loadReferenceReplaySource(brandId: string, now: Date): Promise<ReferenceCandidate | null> {
  const [examples, recentReplays] = await Promise.all([
    prisma.viralExample.findMany({
      where: { brandId, source: { not: SHORTS_SOURCE }, publishedAt: { gte: new Date(now.getTime() - SOURCE_WINDOW_DAYS * DAY_MS) } },
      select: { id: true, content: true, authorUsername: true, publishedAt: true, rawMetrics: true },
    }),
    prisma.post.findMany({
      where: { brandId, formulaId: REFERENCE_REPLAY_MODE.id, createdAt: { gte: new Date(now.getTime() - USED_TAG_WINDOW_DAYS * DAY_MS) } },
      select: { qualityReasons: true },
    }),
  ]);
  return pickReferenceReplaySource(examples, recentReplays.flatMap((post) => parseReasons(post.qualityReasons)), now);
}

/** Keeps a source whose draft was discarded (e.g. similarity check) from topping the list again the next day. */
export async function markReferenceAttempted(exampleId: string, now: Date): Promise<void> {
  const row = await prisma.viralExample.findUnique({ where: { id: exampleId }, select: { rawMetrics: true } });
  if (!row) return;
  const metrics = { ...parseMetrics(row.rawMetrics), replayAttemptedAt: now.toISOString() };
  await prisma.viralExample.update({ where: { id: exampleId }, data: { rawMetrics: JSON.stringify(metrics) } });
}
