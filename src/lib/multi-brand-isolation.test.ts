import { describe, it, expect } from "vitest";
import { getDomainPreset, DOMAIN_PRESETS } from "./domain-registry";
import { selectFormulaWithQuota } from "./quota-bandit-router";
import { buildTrackedUrl } from "./tracking-url";
import { buildGrowthMemory } from "./growth-learning";

describe("Multi-Brand Zero-Contamination Isolation Verification", () => {
  describe("1. Voice & Topic Isolation", () => {
    it("strictly isolates B2B SaaS domain from Saju terms", () => {
      const saasPreset = getDomainPreset("saas_b2b");
      const saasForbidden = saasPreset.forbiddenCrossDomainTerms;

      // Verify B2B SaaS explicitly forbids Saju/Astrology keywords
      expect(saasForbidden).toContain("사주");
      expect(saasForbidden).toContain("도화살");
      expect(saasForbidden).toContain("신살");

      // Verify B2B topics contain zero Saju terms
      const hasSajuTermsInSaaS = saasPreset.defaultTopics.some((topic) =>
        ["도화", "사주", "팔자", "운세", "대운"].some((term) => topic.includes(term))
      );
      expect(hasSajuTermsInSaaS).toBe(false);
    });

    it("strictly isolates Saju domain from B2B enterprise SaaS terms", () => {
      const sajuPreset = getDomainPreset("saju_viral");
      const sajuForbidden = sajuPreset.forbiddenCrossDomainTerms;

      expect(sajuForbidden).toContain("MRR");
      expect(sajuForbidden).toContain("SaaS");
      expect(sajuForbidden).toContain("데모 신청");

      // Verify Saju topics contain zero B2B jargon
      const hasB2BTermsInSaju = sajuPreset.defaultTopics.some((topic) =>
        ["MRR", "API", "B2B"].some((term) => topic.includes(term))
      );
      expect(hasB2BTermsInSaju).toBe(false);
    });
  });

  describe("2. Learning Memory & Weight Isolation", () => {
    it("ensures Brand A's performance score does not bleed into Brand B's memory", () => {
      // Brand A (Saju): Huge breakout on controversy_stunt
      const brandAPosts = [
        {
          id: "post_saju_1",
          formulaId: "controversy_stunt",
          topic: "진태양시",
          targetAudience: "사주 관심층",
          hookType: "폭로",
          ctaType: "확인",
          views: 39000,
          likes: 88,
          replies: 29,
          reposts: 16,
          performanceScore: 9383,
        },
        {
          id: "post_saju_2",
          formulaId: "controversy_stunt",
          topic: "진태양시 2",
          targetAudience: "사주 관심층",
          hookType: "폭로",
          ctaType: "확인",
          views: 30000,
          likes: 70,
          replies: 25,
          reposts: 10,
          performanceScore: 7500,
        },
      ];

      // Brand B (B2B SaaS): Small initial posts on b2b_pain_poll
      const brandBPosts = [
        {
          id: "post_b2b_1",
          formulaId: "b2b_pain_poll",
          topic: "엑셀 수작업",
          targetAudience: "스타트업 리더",
          hookType: "고통 공감",
          ctaType: "데모 신청",
          views: 500,
          likes: 10,
          replies: 4,
          reposts: 2,
          performanceScore: 350,
        },
        {
          id: "post_b2b_2",
          formulaId: "b2b_pain_poll",
          topic: "슬랙 알림 지옥",
          targetAudience: "스타트업 리더",
          hookType: "고통 공감",
          ctaType: "데모 신청",
          views: 600,
          likes: 12,
          replies: 5,
          reposts: 3,
          performanceScore: 420,
        },
      ];

      const memoryA = buildGrowthMemory(brandAPosts);
      const memoryB = buildGrowthMemory(brandBPosts);

      // Brand A memory has controversy_stunt as winner
      expect(memoryA.winners.some((w) => w.value === "controversy_stunt")).toBe(true);

      // Brand B memory is completely clean of controversy_stunt
      expect(memoryB.winners.some((w) => w.value === "controversy_stunt")).toBe(false);
      expect(memoryB.winners.some((w) => w.value === "b2b_pain_poll")).toBe(true);
    });
  });

  describe("3. Tracking Link & Attribution Isolation", () => {
    it("generates isolated tracking URLs without cross-linking domains", () => {
      const sajuUrl = buildTrackedUrl("https://www.cosmicpath.app/start", {
        postId: "post_saju_99",
        formulaId: "fact_bomb_incumbent_attack",
        track: "track_b",
        source: "threads_kr",
      });

      const etsyGlobalUrl = buildTrackedUrl("https://www.etsy.com/shop/ByYoungStudio", {
        postId: "post_etsy_88",
        formulaId: "d2c_etsy_offer",
        track: "track_c",
        source: "threads_global",
      });

      const saasDemoUrl = buildTrackedUrl("https://catchdex.com/demo", {
        postId: "post_saas_77",
        formulaId: "b2b_demo_offer",
        track: "track_c",
        source: "threads_saas",
      });

      expect(sajuUrl).toContain("https://www.cosmicpath.app/start");
      expect(sajuUrl).toContain("pid=post_saju_99");
      expect(sajuUrl).not.toContain("etsy.com");
      expect(sajuUrl).not.toContain("catchdex.com");

      expect(etsyGlobalUrl).toContain("https://www.etsy.com/shop/ByYoungStudio");
      expect(etsyGlobalUrl).toContain("pid=post_etsy_88");
      expect(etsyGlobalUrl).not.toContain("cosmicpath.app");

      expect(saasDemoUrl).toContain("https://catchdex.com/demo");
      expect(saasDemoUrl).toContain("pid=post_saas_77");
      expect(saasDemoUrl).not.toContain("cosmicpath.app");
    });
  });
});
