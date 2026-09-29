/**
 * Account Trust & Warming Ramp
 *
 * Prevents Meta sandbox bans by enforcing graduated daily volume quotas,
 * feature gates (restricting commercial links/aggressive hooks on young accounts),
 * and progressive trust tier progression based on account age and health score.
 */

export type AccountTrustTier = "newbie" | "warming" | "established" | "authority";

export interface AccountTrustProfile {
  tier: AccountTrustTier;
  ageDays: number;
  dailyQuota: number;
  canUseCommentLinks: boolean;
  canUseAutoPlug: boolean;
  canUseAggressiveHooks: boolean;
}

export type TrustGatedFeature =
  | "body_link"
  | "comment_link"
  | "conversation_igniter"
  | "aggressive_hook"
  | "auto_plug";

export interface AccountEligibilityInput {
  tier: AccountTrustTier;
  publishedTodayCount: number;
  hasCommentLink?: boolean;
  hasBodyLink?: boolean;
  hasAggressiveHook?: boolean;
}

export interface EligibilityResult {
  eligible: boolean;
  reason?: string;
  maxDailyQuota: number;
  currentCount: number;
}

const TIER_DAILY_QUOTAS: Record<AccountTrustTier, number> = {
  newbie: 1,
  warming: 2,
  established: 3,
  authority: 5,
};

/**
 * Resolves the account trust tier based on account age in days and optional trust score.
 */
export function resolveAccountTrustTier(
  accountCreatedAt: Date,
  now: Date = new Date(),
  options?: { trustScore?: number }
): AccountTrustTier {
  const diffMs = now.getTime() - accountCreatedAt.getTime();
  const ageDays = Math.max(0, Math.floor(diffMs / (24 * 60 * 60 * 1000)));
  const score = options?.trustScore ?? 50;

  if (ageDays >= 90 && score >= 75) {
    return "authority";
  }
  if (ageDays >= 30) {
    return "established";
  }
  if (ageDays >= 7) {
    return "warming";
  }
  return "newbie";
}

/**
 * Returns full profile details for a given tier.
 */
export function getAccountTrustProfile(
  accountCreatedAt: Date,
  now: Date = new Date(),
  options?: { trustScore?: number }
): AccountTrustProfile {
  const tier = resolveAccountTrustTier(accountCreatedAt, now, options);
  const diffMs = now.getTime() - accountCreatedAt.getTime();
  const ageDays = Math.max(0, Math.floor(diffMs / (24 * 60 * 60 * 1000)));

  return {
    tier,
    ageDays,
    dailyQuota: TIER_DAILY_QUOTAS[tier],
    canUseCommentLinks: tier !== "newbie",
    canUseAutoPlug: tier === "established" || tier === "authority",
    canUseAggressiveHooks: tier !== "newbie",
  };
}

/**
 * Checks whether a specific feature is permitted for the given tier.
 */
export function isFeatureAllowedForTier(
  tier: AccountTrustTier,
  feature: TrustGatedFeature
): boolean {
  switch (feature) {
    case "body_link":
      // Threads 2026 penalizes body links across all tiers!
      return false;
    case "comment_link":
      // Newbie accounts cannot post external links even in comments
      return tier !== "newbie";
    case "conversation_igniter":
      // All accounts benefit from organic conversation igniters
      return true;
    case "aggressive_hook":
      // High-ego, polarizing comparison hooks are forbidden on newbie accounts to prevent early reports
      return tier !== "newbie";
    case "auto_plug":
      // Auto-plugging conversion links requires at least established tier
      return tier === "established" || tier === "authority";
    default:
      return false;
  }
}

/**
 * Evaluates whether an account is eligible to publish a specific post draft right now.
 */
export function verifyAccountPublishEligibility(
  input: AccountEligibilityInput
): EligibilityResult {
  const maxDailyQuota = TIER_DAILY_QUOTAS[input.tier];

  // 1. Quota Check
  if (input.publishedTodayCount >= maxDailyQuota) {
    return {
      eligible: false,
      reason: `일일 발행 한도 초과 (${input.publishedTodayCount}/${maxDailyQuota}회). ${input.tier.toUpperCase()} 등급 샌드박스 보호 적용 중.`,
      maxDailyQuota,
      currentCount: input.publishedTodayCount,
    };
  }

  // 2. Body Link Check (Strictly forbidden by 2026 algorithm)
  if (input.hasBodyLink) {
    return {
      eligible: false,
      reason: "본문 외부 링크 삽입 금지 (알고리즘 노출 80% 차단 방지). 바이오 링크 또는 오토플러그를 이용하십시오.",
      maxDailyQuota,
      currentCount: input.publishedTodayCount,
    };
  }

  // 3. Comment Link on Newbie Tier
  if (input.hasCommentLink && !isFeatureAllowedForTier(input.tier, "comment_link")) {
    return {
      eligible: false,
      reason: "신규(NEWBIE) 계정은 첫 댓글 외부 링크가 제한됩니다 (스팸 탐지 방지). 7일 경과 후 해제됩니다.",
      maxDailyQuota,
      currentCount: input.publishedTodayCount,
    };
  }

  // 4. Aggressive Hook on Newbie Tier
  if (input.hasAggressiveHook && !isFeatureAllowedForTier(input.tier, "aggressive_hook")) {
    return {
      eligible: false,
      reason: "신규(NEWBIE) 계정은 신고 위험이 높은 도발적/서열 비교 훅이 제한됩니다. 공감/질문형 훅을 사용하십시오.",
      maxDailyQuota,
      currentCount: input.publishedTodayCount,
    };
  }

  return {
    eligible: true,
    maxDailyQuota,
    currentCount: input.publishedTodayCount,
  };
}
