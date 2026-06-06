import type { Brand } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  buildTikTokPrompt,
  generateTikTokVideoDrafts,
  normalizeTikTokCandidateFromRaw,
} from "@/lib/tiktok-video-service";
import { TIKTOK_VIDEO_EXPERIMENT_DEFAULT } from "@/types/tiktok-config";

describe("generateTikTokVideoDrafts", () => {
  it("keeps default quiet contrarian TikTok prompt free of question intake", () => {
    const format = TIKTOK_VIDEO_EXPERIMENT_DEFAULT.formats.find((item) => item.id === "quiet_contrarian");

    expect(format).toBeDefined();
    if (!format) throw new Error("quiet_contrarian format missing");
    const prompt = buildTikTokPrompt({
      format,
      durationSeconds: 25,
      growthContext: "growth memory",
      viralContext: "viral memory",
      accountContext: "account memory",
    });

    expect(prompt).toContain("저장, 프로필 확인, 행동선 정리");
    expect(prompt).not.toContain("질문 접수");
    expect(prompt).not.toContain("댓글/프로필");
  });

  it("falls back when the AI returns a non-JSON error message", () => {
    const format = TIKTOK_VIDEO_EXPERIMENT_DEFAULT.formats.find((item) => item.id === "self_classification");

    expect(format).toBeDefined();
    if (!format) throw new Error("self_classification format missing");
    const candidate = normalizeTikTokCandidateFromRaw(
      "An error occurred while generating the response.",
      format,
      25,
      0
    );

    expect(candidate.title).toContain(format.name);
    expect(candidate.script).toContain("버팀형");
    expect(candidate.cta).toContain("저장");
  });

  it("rejects disabled TikTok video lab before generating drafts", async () => {
    const brand: Brand = {
      id: "brand_disabled_tiktok",
      ownerId: "user_disabled_tiktok",
      name: "InvoiceFlow",
      slug: "invoice-flow",
      accessToken: "token",
      threadsUserId: "threads_user",
      tokenExpiry: new Date("2035-01-01T00:00:00.000Z"),
      brandConfig: JSON.stringify({
        campaigns: [{
          id: "product_growth_baseline",
          name: "제품 성장 baseline",
          mode: "landing-test",
          qualityProfile: "product_growth",
          landingUrl: "",
          utmSource: "threads",
          utmCampaign: "invoice_flow",
          utmContentTemplate: "{{postId}}",
          dailyPostTarget: 3,
          linkCadenceEvery: 3,
          linkPlacement: "firstComment",
          formulas: [],
          replyPlaybook: {},
        }],
        activeCampaignId: "product_growth_baseline",
        tiktokVideo: {
          enabled: false,
          parentCampaignId: "product_growth_baseline",
          landingUrl: "",
          formats: [],
        },
      }),
      formulaWeights: "{}",
      growthMemory: "{}",
      viralMemory: "{}",
      createdAt: new Date("2026-06-04T00:00:00.000Z"),
      updatedAt: new Date("2026-06-04T00:00:00.000Z"),
    };

    await expect(generateTikTokVideoDrafts({ brand, count: 1 })).rejects.toThrow("TikTok video lab is disabled");
  });
});
