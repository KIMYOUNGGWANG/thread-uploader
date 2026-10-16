import { describe, expect, it } from "vitest";
import {
  resolveAccountTrustTier,
  getAccountTrustProfile,
  isFeatureAllowedForTier,
  verifyAccountPublishEligibility,
  startOfPublishDay,
  TIER_DAILY_QUOTAS,
} from "./account-trust-ramp";

describe("account-trust-ramp", () => {
  it("classifies accounts into tiers based on age and score", () => {
    const now = new Date("2026-09-09T12:00:00Z");

    // 3 days old -> newbie
    const newbieDate = new Date("2026-09-06T12:00:00Z");
    expect(resolveAccountTrustTier(newbieDate, now)).toBe("newbie");

    // 15 days old -> warming
    const warmingDate = new Date("2026-08-25T12:00:00Z");
    expect(resolveAccountTrustTier(warmingDate, now)).toBe("warming");

    // 45 days old -> established
    const establishedDate = new Date("2026-07-26T12:00:00Z");
    expect(resolveAccountTrustTier(establishedDate, now)).toBe("established");

    // 100 days old with high score (80) -> authority
    const authorityDate = new Date("2026-05-01T12:00:00Z");
    expect(resolveAccountTrustTier(authorityDate, now, { trustScore: 85 })).toBe("authority");

    // 100 days old with low score (50) -> established
    expect(resolveAccountTrustTier(authorityDate, now, { trustScore: 50 })).toBe("established");
  });

  it("enforces feature gates per tier", () => {
    // Body link is never allowed in Threads 2026
    expect(isFeatureAllowedForTier("newbie", "body_link")).toBe(false);
    expect(isFeatureAllowedForTier("authority", "body_link")).toBe(false);

    // Comment link blocked on newbie, allowed on warming+
    expect(isFeatureAllowedForTier("newbie", "comment_link")).toBe(false);
    expect(isFeatureAllowedForTier("warming", "comment_link")).toBe(true);

    // Aggressive hook blocked on newbie
    expect(isFeatureAllowedForTier("newbie", "aggressive_hook")).toBe(false);
    expect(isFeatureAllowedForTier("warming", "aggressive_hook")).toBe(true);

    // Auto-plug allowed on established and authority only
    expect(isFeatureAllowedForTier("newbie", "auto_plug")).toBe(false);
    expect(isFeatureAllowedForTier("warming", "auto_plug")).toBe(false);
    expect(isFeatureAllowedForTier("established", "auto_plug")).toBe(true);
    expect(isFeatureAllowedForTier("authority", "auto_plug")).toBe(true);
  });

  it("blocks publishing when daily tier quota is exceeded", () => {
    // Newbie has quota of 1
    const result1 = verifyAccountPublishEligibility({
      tier: "newbie",
      publishedTodayCount: 1,
    });
    expect(result1.eligible).toBe(false);
    expect(result1.reason).toContain("일일 발행 한도 초과");

    // Warming has quota of 2
    const result2 = verifyAccountPublishEligibility({
      tier: "warming",
      publishedTodayCount: 1,
    });
    expect(result2.eligible).toBe(true);

    const result3 = verifyAccountPublishEligibility({
      tier: "warming",
      publishedTodayCount: 2,
    });
    expect(result3.eligible).toBe(false);

    // Established matches the 5 daily KR slots; authority leaves headroom above that
    expect(TIER_DAILY_QUOTAS.established).toBe(5);
    expect(TIER_DAILY_QUOTAS.authority).toBe(8);
    expect(verifyAccountPublishEligibility({ tier: "established", publishedTodayCount: 4 }).eligible).toBe(true);
  });

  it("starts the publish day at KST midnight", () => {
    // 2026-10-13T20:00Z is 2026-10-14 05:00 KST → day started at 2026-10-13T15:00Z
    expect(startOfPublishDay(new Date("2026-10-13T20:00:00Z")).toISOString()).toBe("2026-10-13T15:00:00.000Z");
    expect(startOfPublishDay(new Date("2026-10-13T10:00:00Z")).toISOString()).toBe("2026-10-12T15:00:00.000Z");
  });

  it("blocks body links and newbie comment links", () => {
    // Body link blocked
    const bodyLinkCheck = verifyAccountPublishEligibility({
      tier: "established",
      publishedTodayCount: 0,
      hasBodyLink: true,
    });
    expect(bodyLinkCheck.eligible).toBe(false);
    expect(bodyLinkCheck.reason).toContain("본문 외부 링크");

    // Comment link blocked for newbie
    const commentLinkCheck = verifyAccountPublishEligibility({
      tier: "newbie",
      publishedTodayCount: 0,
      hasCommentLink: true,
    });
    expect(commentLinkCheck.eligible).toBe(false);
    expect(commentLinkCheck.reason).toContain("신규(NEWBIE) 계정은 첫 댓글");
  });
});
