import { prisma } from "@/lib/prisma";
import { NEW_YEAR_MODE_IDS } from "@/lib/new-year/new-year-season";
import { REFERENCE_INFO_MODE_ID, REFERENCE_REPLAY_MODE, WINNER_REPLAY_MODE } from "@/lib/viral-intent-modes";

// Stored in a replay draft's qualityReasons so the same source is not replayed again within the cooldown.
export const WINNER_REPLAY_SOURCE_PREFIX = "winner_replay_source:";

const SOURCE_WINDOW_DAYS = 60;
const REPLAY_COOLDOWN_DAYS = 14;
const WINNER_MEDIAN_MULTIPLIER = 5;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface WinnerCandidatePost {
  id: string;
  content: string;
  views: number;
}

// Lower median: with an even count it takes the smaller middle value, so one viral outlier cannot lift the bar.
function lowerMedian(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor((sorted.length - 1) / 2)];
}

// A post counts as a winner at 5x the brand's median views; the best one not replayed recently is returned.
export function pickWinnerReplaySource(
  posts: WinnerCandidatePost[],
  recentReplayReasons: string[]
): WinnerCandidatePost | null {
  if (posts.length === 0) return null;
  const threshold = lowerMedian(posts.map((post) => post.views)) * WINNER_MEDIAN_MULTIPLIER;
  if (threshold <= 0) return null;
  const used = new Set(recentReplayReasons);
  const winners = posts
    .filter((post) => post.views >= threshold && !used.has(`${WINNER_REPLAY_SOURCE_PREFIX}${post.id}`))
    .sort((a, b) => b.views - a.views);
  return winners[0] ?? null;
}

export function parseReasons(raw: string): string[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((reason): reason is string => typeof reason === "string") : [];
  } catch {
    return [];
  }
}

export async function loadWinnerReplaySource(brandId: string, now: Date): Promise<WinnerCandidatePost | null> {
  const [published, recentReplays] = await Promise.all([
    prisma.post.findMany({
      where: {
        brandId,
        status: "PUBLISHED",
        views: { not: null },
        publishedAt: { gte: new Date(now.getTime() - SOURCE_WINDOW_DAYS * DAY_MS) },
        // No replay-of-replay and no seasonal New Year posts. formulaId is nullable and SQL `<>` drops NULL rows, so keep them explicitly.
        OR: [{ formulaId: null }, { formulaId: { notIn: [WINNER_REPLAY_MODE.id, REFERENCE_REPLAY_MODE.id, REFERENCE_INFO_MODE_ID, ...NEW_YEAR_MODE_IDS] } }],
      },
      select: { id: true, content: true, views: true },
    }),
    prisma.post.findMany({
      where: {
        brandId,
        formulaId: WINNER_REPLAY_MODE.id,
        createdAt: { gte: new Date(now.getTime() - REPLAY_COOLDOWN_DAYS * DAY_MS) },
      },
      select: { qualityReasons: true },
    }),
  ]);
  const candidates = published.map((post) => ({ id: post.id, content: post.content, views: post.views ?? 0 }));
  return pickWinnerReplaySource(candidates, recentReplays.flatMap((post) => parseReasons(post.qualityReasons)));
}
