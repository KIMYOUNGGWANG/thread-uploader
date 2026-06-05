import type { Brand } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { generateTikTokVideoDrafts } from "@/lib/tiktok-video-service";

describe("generateTikTokVideoDrafts", () => {
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
