import { getThreadsContentLimitError } from "@/lib/threads-limits";
import { hasFortuneOverclaim, hasReplyBurdenPromise } from "@/lib/viral-intent-modes";
import {
  scoreThreadsPostAlgorithmic,
  type AlgorithmicPredictionResult,
} from "@/lib/threads-algorithm-scorer";
import {
  verifyAccountPublishEligibility,
  type AccountTrustTier,
} from "@/lib/account-trust-ramp";

import type { PostCategory, AccountHealthState } from "@/types/brand";

const GENERATED_META_PATTERNS = [
  /자수\s*체크/,
  /글자\s*수\s*확인/,
  /공백[·\s]*줄바꿈.*포함/,
  /500자\s*이하\s*통과/,
  /Threads\s*본문/,
  /초안\s*작성/,
];

export interface PublishSafetyPost {
  content: string;
  firstComment: string | null;
  postCategory?: PostCategory | string;
}

export interface PublishSafetyOptions {
  allowMultiPart?: boolean;
  minAlgorithmicScore?: number; // e.g. 75 or 80
  accountTrust?: {
    tier: AccountTrustTier;
    publishedTodayCount: number;
    hasAggressiveHook?: boolean;
  };
  accountHealth?: Partial<AccountHealthState>;
}

export function getPublishSafetyBlockReasons(
  post: PublishSafetyPost,
  options?: PublishSafetyOptions
): string[] {
  const reasons: string[] = [];

  // Shadowban Health Protection & Self-Healing Guard
  if (options?.accountHealth?.status === "SHADOWBAN_SUSPECTED") {
    if (post.postCategory && post.postCategory !== "WARMUP") {
      reasons.push("스텔스 섀도우밴 위험 상태: WARMUP 카테고리 포스트만 발행 가능");
    }
    const hasAnyLink =
      /https?:\/\/[^\s]+/i.test(post.content) ||
      Boolean(post.firstComment && /https?:\/\/[^\s]+/i.test(post.firstComment));
    if (hasAnyLink) {
      reasons.push("스텔스 섀도우밴 위험 상태: 외부 링크 포함 포스트 발행 금지");
    }
  }
  const lengthError = getThreadsContentLimitError(post.content, {
    allowMultiPart: options?.allowMultiPart ?? true,
  });
  if (lengthError) reasons.push(lengthError);

  const surface = [post.content, post.firstComment ?? ""].join("\n");
  if (hasReplyBurdenPromise(surface)) {
    reasons.push("reply-burden CTA 포함");
  }
  if (hasFortuneOverclaim(surface)) {
    reasons.push("overclaim 운세/상대 마음 보장 표현 포함");
  }
  if (GENERATED_META_PATTERNS.some((pattern) => pattern.test(surface))) {
    reasons.push("generated meta text 포함");
  }

  // Account Trust Ramp Verification
  if (options?.accountTrust) {
    const hasCommentLink = Boolean(post.firstComment && /https?:\/\/[^\s]+/i.test(post.firstComment));
    const hasBodyLink = /https?:\/\/[^\s]+/i.test(post.content);
    const eligibility = verifyAccountPublishEligibility({
      tier: options.accountTrust.tier,
      publishedTodayCount: options.accountTrust.publishedTodayCount,
      hasCommentLink,
      hasBodyLink,
      hasAggressiveHook: options.accountTrust.hasAggressiveHook,
    });
    if (!eligibility.eligible && eligibility.reason) {
      reasons.push(eligibility.reason);
    }
  }

  // Pre-Publish 5D Algorithmic Score Check (if threshold is set)
  if (options?.minAlgorithmicScore) {
    const scoreResult: AlgorithmicPredictionResult = scoreThreadsPostAlgorithmic(
      post.content,
      post.firstComment
    );
    if (scoreResult.totalScore < options.minAlgorithmicScore) {
      reasons.push(
        `알고리즘 탈출 점수 미달 (${scoreResult.totalScore}/${options.minAlgorithmicScore}점). 수정 권고: ${scoreResult.actionableFixes.slice(0, 2).join("; ")}`
      );
    }
  }

  return reasons;
}

