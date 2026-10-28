import {
  calculateSearchSignalScore,
  calculateStructuralSignalScore,
  type RankHistoryEntry,
  type SearchSignal,
} from "@/lib/viral-analysis";

// 답글 여부는 다른 계정 글에서 얻을 수 있는 유일한 글별 반응 신호다.
export const HAS_REPLIES_BONUS = 10;
// TOP에 2번 이상 잡혀야 한다. 4시간 주기 수집 기준 최소 4시간 머문 글이고, 1회는 검색 순위 노이즈일 수 있다.
export const MIN_TIMES_SEEN = 2;
// timesSeen은 대시보드 수동 수집으로도 오르니 첫 발견 후 시간이 지났는지도 본다. 4시간 주기 수집에서 지연 여유 1h.
export const MIN_SEEN_AGE_MS = 3 * 60 * 60 * 1000;
// 참고 글은 지금 반응이 있는 최신 글이어야 해서 7일 이내로 제한한다.
export const SOURCE_MAX_AGE_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

// 3·15·5는 calculateSearchSignalScore의 순위 1단계(3점)에 맞춘 값. 추측이며 20개 판정(스펙 6장)으로 검증한다.
export const RANK_GAIN_WEIGHT = 3;
export const FRESH_24H_BONUS = 15;
export const FRESH_48H_BONUS = 5;

export function normalizeHandle(handle: string): string {
  return handle.trim().replace(/^@/, "").trim().toLowerCase();
}

export function calculateReferenceScore(input: {
  signal: SearchSignal;
  content: string;
  hasReplies: boolean | null;
}): number {
  return (
    calculateSearchSignalScore(input.signal) +
    (input.hasReplies ? HAS_REPLIES_BONUS : 0) +
    calculateStructuralSignalScore(input.content)
  );
}

export interface EligibilityInput {
  authorUsername: string | null;
  publishedAt: Date | null;
  timesSeen: number;
  firstSeenAt: string | null;
}

export interface EligibilityRules {
  ownHandle: string | null;
  excludedHandles: string[];
  now: Date;
}

export function isEligibleSource(input: EligibilityInput, rules: EligibilityRules): boolean {
  if (!input.authorUsername || !input.publishedAt) return false;
  if (input.timesSeen < MIN_TIMES_SEEN) return false;
  const firstSeen = input.firstSeenAt ? Date.parse(input.firstSeenAt) : NaN;
  if (!(rules.now.getTime() - firstSeen >= MIN_SEEN_AGE_MS)) return false;
  if (rules.now.getTime() - input.publishedAt.getTime() > SOURCE_MAX_AGE_DAYS * DAY_MS) return false;

  const handle = normalizeHandle(input.authorUsername);
  if (rules.ownHandle && handle === normalizeHandle(rules.ownHandle)) return false;
  return !rules.excludedHandles.some((excluded) => normalizeHandle(excluded) === handle);
}

export function calculateRisingScore(input: {
  referenceScore: number;
  rankHistory: RankHistoryEntry[];
  publishedAt: Date | null;
  now: Date;
}): number {
  const history = input.rankHistory;
  const latest = history.at(-1);
  const rankGain =
    latest && history.length > 1
      ? Math.max(0, Math.min(...history.slice(0, -1).map((entry) => entry.rank)) - latest.rank)
      : 0;
  const ageMs = input.publishedAt ? input.now.getTime() - input.publishedAt.getTime() : Infinity;
  const freshness = ageMs <= 24 * HOUR_MS ? FRESH_24H_BONUS : ageMs <= 48 * HOUR_MS ? FRESH_48H_BONUS : 0;
  return input.referenceScore + rankGain * RANK_GAIN_WEIGHT + freshness;
}
