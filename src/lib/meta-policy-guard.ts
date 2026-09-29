/**
 * Meta Policy & Shadowban Safety Guard (2026 Edition)
 *
 * Protects account reputation and organic distribution against:
 * 1. Meta Community Guidelines policy trigger words (financial overclaims, medical, superstitious scams)
 * 2. Negative feedback accumulation (hides, reports, block signals)
 * 3. Shadowban risk detection with automatic formula family circuit breakers
 */

export interface PolicyViolation {
  category: "financial_overclaim" | "medical_health" | "superstitious_scam" | "engagement_bait" | "harassment";
  pattern: string;
  penalty: number;
  reason: string;
}

export interface PolicyCheckResult {
  pass: boolean;
  score: number; // 0 to 100
  violations: PolicyViolation[];
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  recommendations: string[];
}

export interface PostFeedbackMetrics {
  views: number;
  likes: number;
  replies: number;
  reposts: number;
  hides?: number;
  reports?: number;
  negativeReplies?: number;
}

export interface CircuitBreakerStatus {
  formulaId: string;
  isFrozen: boolean;
  negativeRate: number;
  reason?: string;
}

// Meta 2026 High-Risk Guidelines Trigger Patterns
export const META_POLICY_TRIGGERS: Array<{
  category: PolicyViolation["category"];
  pattern: RegExp;
  penalty: number;
  reason: string;
}> = [
  // 1. Financial Get-Rich-Quick / Overclaims
  {
    category: "financial_overclaim",
    pattern: /월\s*(1000|500|3000)만\s*원\s*(보장|벌기|수익)|무조건\s*(수익|대박|부자)|원금\s*보장|수익률\s*\d{2,3}%/i,
    penalty: 40,
    reason: "메타 금융 사기 및 고위험 투자 유도 탐지 어휘",
  },
  {
    category: "financial_overclaim",
    pattern: /로또\s*1등\s*(당첨|번호|비법)|코인\s*급등\s*정보/i,
    penalty: 50,
    reason: "도박 및 투기성 확증 편향 조장 어휘",
  },

  // 2. Medical / Mental Health Absolutism
  {
    category: "medical_health",
    pattern: /우울증\s*(100%|완전)\s*치료|암\s*(완치|정복)|병원\s*갈\s*필요\s*없/i,
    penalty: 40,
    reason: "메타 의료/건강 허위 정보 및 치료 보장 규정 위반",
  },

  // 3. Superstitious Scams & Coercion
  {
    category: "superstitious_scam",
    pattern: /조상신\s*(노여움|저주)|부적\s*(안\s*쓰면|사야)|굿\s*(비용|안\s*하면\s*사망)|사주\s*안\s*보면\s*망함/i,
    penalty: 45,
    reason: "공포 마케팅 기반 미신 사기 및 강요 어휘",
  },

  // 4. Algorithm Demoted Engagement Bait
  {
    category: "engagement_bait",
    pattern: /좋아요(를)?\s*누르고\s*저장하면\s*(소원|운세|대박)|댓글로\s*['"][^'"]+['"]\s*(달면|남기면)\s*DM/i,
    penalty: 30,
    reason: "2026 메타 알고리즘 공식 감점 대상 Engagement Bait",
  },
];

/**
 * Screen content against Meta Community Guidelines before publishing
 */
export function checkMetaPolicySafety(content: string): PolicyCheckResult {
  const violations: PolicyViolation[] = [];
  let score = 100;

  for (const trigger of META_POLICY_TRIGGERS) {
    if (trigger.pattern.test(content)) {
      score -= trigger.penalty;
      violations.push({
        category: trigger.category,
        pattern: trigger.pattern.source,
        penalty: trigger.penalty,
        reason: trigger.reason,
      });
    }
  }

  score = Math.max(0, score);
  let riskLevel: PolicyCheckResult["riskLevel"] = "LOW";
  if (score < 50) riskLevel = "CRITICAL";
  else if (score < 70) riskLevel = "HIGH";
  else if (score < 85) riskLevel = "MEDIUM";

  const pass = score >= 80 && violations.length === 0;
  const recommendations: string[] = [];
  for (const v of violations) {
    recommendations.push(`[${v.category}] ${v.reason} 위험 표현을 삭제하거나 완화하세요.`);
  }

  return {
    pass,
    score,
    violations,
    riskLevel,
    recommendations,
  };
}

/**
 * Negative Feedback Circuit Breaker
 * Monitors user hide/report rates. If a formula triggers > 3.5% negative feedback,
 * immediately freezes the formula to prevent account shadowbanning.
 */
export function evaluateNegativeFeedbackCircuitBreaker(
  formulaId: string,
  metrics: PostFeedbackMetrics[]
): CircuitBreakerStatus {
  if (metrics.length === 0) {
    return { formulaId, isFrozen: false, negativeRate: 0 };
  }

  const totalViews = metrics.reduce((sum, m) => sum + Math.max(0, m.views), 0);
  if (totalViews < 500) {
    // Insufficient sample size to make a statistical freeze decision
    return { formulaId, isFrozen: false, negativeRate: 0 };
  }

  const totalHides = metrics.reduce((sum, m) => sum + (m.hides ?? 0), 0);
  const totalReports = metrics.reduce((sum, m) => sum + (m.reports ?? 0), 0);
  const totalNegatives = metrics.reduce((sum, m) => sum + (m.negativeReplies ?? 0), 0);

  // Negative feedback weight: reports are 10x worse than hides
  const weightedNegatives = totalHides * 1.0 + totalReports * 10.0 + totalNegatives * 1.5;
  const negativeRate = (weightedNegatives / totalViews) * 100;

  // Threshold: > 3.5% weighted negative signals triggers safety freeze
  const CRITICAL_NEGATIVE_THRESHOLD = 3.5;
  const isFrozen = negativeRate >= CRITICAL_NEGATIVE_THRESHOLD;

  return {
    formulaId,
    isFrozen,
    negativeRate: Math.round(negativeRate * 100) / 100,
    reason: isFrozen
      ? `부정 피드백(신고/숨김) 비율 ${negativeRate.toFixed(2)}% 초과로 계정 보호를 위해 공식 자동 동결(Circuit Breaker Trip)`
      : undefined,
  };
}
