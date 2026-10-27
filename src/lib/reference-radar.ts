import {
  calculateSearchSignalScore,
  calculateStructuralSignalScore,
  type SearchSignal,
} from "@/lib/viral-analysis";

// 답글 여부는 다른 계정 글에서 얻을 수 있는 유일한 글별 반응 신호다.
export const HAS_REPLIES_BONUS = 10;
// TOP에 2번 이상 잡혀야 한다. 하루 2회 실행 기준 최소 12시간 머문 글이고, 1회는 검색 순위 노이즈일 수 있다.
export const MIN_TIMES_SEEN = 2;
// 참고 글은 지금 반응이 있는 최신 글이어야 해서 7일 이내로 제한한다.
export const SOURCE_MAX_AGE_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

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
}

export interface EligibilityRules {
  ownHandle: string | null;
  excludedHandles: string[];
  now: Date;
}

export function isEligibleSource(input: EligibilityInput, rules: EligibilityRules): boolean {
  if (!input.authorUsername || !input.publishedAt) return false;
  if (input.timesSeen < MIN_TIMES_SEEN) return false;
  if (rules.now.getTime() - input.publishedAt.getTime() > SOURCE_MAX_AGE_DAYS * DAY_MS) return false;

  const handle = normalizeHandle(input.authorUsername);
  if (rules.ownHandle && handle === normalizeHandle(rules.ownHandle)) return false;
  return !rules.excludedHandles.some((excluded) => normalizeHandle(excluded) === handle);
}
