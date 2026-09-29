import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const { buildCosmicPathViralResetConfig } = require("./cosmicpath-viral-reset-config.js") as {
  buildCosmicPathViralResetConfig: (
    config: Record<string, unknown>,
    options?: { startedAt?: string }
  ) => Record<string, unknown>;
};

describe("buildCosmicPathViralResetConfig", () => {
  it("installs the exact 4:4:4:3 campaign with three posts per day and every-third links", () => {
    const result = buildCosmicPathViralResetConfig({
      websiteUrl: "https://cosmicpath.app",
      productProfile: { landingUrl: "https://cosmicpath.app/ko/contact-timing" },
      campaigns: [],
    }, { startedAt: "2026-09-27T12:00:00.000Z" }) as {
      activeCampaignId: string;
      campaigns: Array<{
        id: string;
        dailyPostTarget: number;
        linkCadenceEvery: number;
        formulas: Array<{ id: string; weight: number }>;
      }>;
      activeExperiment: { id: string; durationDays: number; startedAt: string };
    };

    const campaign = result.campaigns[0];
    expect(result.activeCampaignId).toBe("cosmicpath_viral_reset_v1");
    expect(campaign.id).toBe("cosmicpath_viral_reset_v1");
    expect(campaign.dailyPostTarget).toBe(3);
    expect(campaign.linkCadenceEvery).toBe(3);
    expect(campaign.formulas.map(({ id, weight }) => ({ id, weight }))).toEqual([
      { id: "imagination_dilemma", weight: 4 },
      { id: "concept_hierarchy", weight: 4 },
      { id: "identity_profile", weight: 4 },
      { id: "relationship_tension", weight: 3 },
    ]);
    expect(result.activeExperiment).toMatchObject({
      id: "cosmicpath_viral_reset_v1",
      durationDays: 5,
      startedAt: "2026-09-27T12:00:00.000Z",
    });
  });

  it("preserves unrelated top-level settings and campaigns", () => {
    const existingCampaign = { id: "keep_me", name: "기존 캠페인" };
    const source = {
      customSetting: { untouched: true },
      topics: ["기존 주제"],
      campaigns: [existingCampaign],
    };

    const result = buildCosmicPathViralResetConfig(source) as {
      customSetting: { untouched: boolean };
      topics: string[];
      campaigns: Array<{ id: string }>;
    };

    expect(result.customSetting).toEqual({ untouched: true });
    expect(result.topics).toEqual(["기존 주제"]);
    expect(result.campaigns).toContainEqual(existingCampaign);
    expect(source).toEqual({
      customSetting: { untouched: true },
      topics: ["기존 주제"],
      campaigns: [existingCampaign],
    });
  });
});
