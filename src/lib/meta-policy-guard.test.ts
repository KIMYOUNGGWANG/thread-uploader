import { describe, expect, it } from "vitest";
import {
  checkMetaPolicySafety,
  evaluateNegativeFeedbackCircuitBreaker,
  type PostFeedbackMetrics,
} from "./meta-policy-guard";

describe("Meta Policy & Shadowban Safety Guard", () => {
  it("passes safe viral content without policy violations", () => {
    const safeContent = [
      "혹시 도화보다 센 홍염보다 센 게 뭔지 알아? 바로 화개야.",
      "화려함을 덮는다는 뜻인데, 스님도 파계시킴.",
      "너한테 그런 치명적인 매력이 숨겨져 있을 수도.",
    ].join("\n");

    const result = checkMetaPolicySafety(safeContent);
    expect(result.pass).toBe(true);
    expect(result.violations).toHaveLength(0);
    expect(result.riskLevel).toBe("LOW");
  });

  it("detects get-rich-quick financial overclaims and flags as critical risk", () => {
    const dangerousContent = "사주 흐름 타고 이번 달에 월 1000만원 수익 보장! 무조건 대박 납니다.";
    const result = checkMetaPolicySafety(dangerousContent);

    expect(result.pass).toBe(false);
    expect(result.violations.some((v) => v.category === "financial_overclaim")).toBe(true);
    expect(result.riskLevel).toBe("HIGH");
  });

  it("detects superstitious scam and fear mongering", () => {
    const scamContent = "올해 조상신 노여움 풀지 않고 부적 안 쓰면 패가망신합니다.";
    const result = checkMetaPolicySafety(scamContent);

    expect(result.pass).toBe(false);
    expect(result.violations.some((v) => v.category === "superstitious_scam")).toBe(true);
  });

  it("trips circuit breaker when weighted negative feedback exceeds threshold", () => {
    // 1000 views with 5 reports and 20 hides -> (20 * 1 + 5 * 10) / 1000 = 7.0% > 3.5%
    const toxicMetrics: PostFeedbackMetrics[] = [
      { views: 500, likes: 10, replies: 5, reposts: 1, hides: 10, reports: 3 },
      { views: 500, likes: 12, replies: 4, reposts: 0, hides: 10, reports: 2 },
    ];

    const status = evaluateNegativeFeedbackCircuitBreaker("sal_hierarchy_ego", toxicMetrics);
    expect(status.isFrozen).toBe(true);
    expect(status.negativeRate).toBeGreaterThan(3.5);
    expect(status.reason).toContain("공식 자동 동결");
  });

  it("does not trip circuit breaker with healthy engagement and low hides", () => {
    const healthyMetrics: PostFeedbackMetrics[] = [
      { views: 5000, likes: 250, replies: 80, reposts: 30, hides: 2, reports: 0 },
    ];

    const status = evaluateNegativeFeedbackCircuitBreaker("sal_hierarchy_ego", healthyMetrics);
    expect(status.isFrozen).toBe(false);
    expect(status.negativeRate).toBeLessThan(1.0);
  });

  it("ignores sample size below 500 views to prevent premature freezing", () => {
    const smallMetrics: PostFeedbackMetrics[] = [
      { views: 100, likes: 2, replies: 0, reposts: 0, hides: 5, reports: 1 },
    ];

    const status = evaluateNegativeFeedbackCircuitBreaker("sal_hierarchy_ego", smallMetrics);
    expect(status.isFrozen).toBe(false);
  });
});
