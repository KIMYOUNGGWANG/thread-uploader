import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { parseBrandConfig } from "@/types/brand";

const require = createRequire(import.meta.url);
const { buildTaraelogBrandConfig, CAMPAIGN_ID, LANDING_URL, FORBIDDEN_PROMISES } = require("./taraelog-brand-config.js") as {
  buildTaraelogBrandConfig: (
    config?: Record<string, unknown>,
    options?: { startedAt?: string; accountTrustTier?: string }
  ) => Record<string, unknown>;
  CAMPAIGN_ID: string;
  LANDING_URL: string;
  FORBIDDEN_PROMISES: string[];
};

describe("buildTaraelogBrandConfig", () => {
  it("survives parseBrandConfig without any field falling back to defaults", () => {
    const raw = buildTaraelogBrandConfig({}, { startedAt: "2026-11-05T00:00:00.000Z" });
    const parsed = parseBrandConfig(JSON.stringify(raw));

    expect(parsed.activeCampaignId).toBe(CAMPAIGN_ID);
    expect(parsed.qualityProfile).toBe("product_growth");
    expect(parsed.websiteUrl).toBe(LANDING_URL);
    expect(parsed.threadsTopicTag).toBe("블로그");
    expect(parsed.accountTrustTier).toBe("warming");
    expect(parsed.productProfile).toEqual(raw.productProfile);
    expect(parsed.activeExperiment).toEqual(raw.activeExperiment);
    expect(parsed.activeExperiment.status).toBe("active");

    const campaign = parsed.campaigns.find((item) => item.id === CAMPAIGN_ID);
    expect(campaign).toMatchObject({
      landingUrl: LANDING_URL,
      utmCampaign: CAMPAIGN_ID,
      dailyPostTarget: 2,
      linkCadenceEvery: 2,
      linkPlacement: "firstComment",
      qualityProfile: "product_growth",
    });
    // 허용되지 않는 formula id는 정규화에서 기본 공식으로 바뀐다. 이름·지시문이 그대로 남아야 한다.
    const rawCampaign = (raw.campaigns as Array<{ id: string; formulas: unknown }>).find((item) => item.id === CAMPAIGN_ID);
    expect(campaign?.formulas).toEqual(rawCampaign?.formulas);
    expect(parsed.voiceProfile?.forbiddenPhrases).toEqual(FORBIDDEN_PROMISES);
  });

  it("stays paused with no start time until the experiment is started", () => {
    const parsed = parseBrandConfig(JSON.stringify(buildTaraelogBrandConfig({})));
    expect(parsed.activeExperiment.status).toBe("paused");
    expect(parsed.activeExperiment.startedAt).toBe("");
  });

  it("keeps other campaigns and unknown stored keys, and replaces its own campaign in place", () => {
    const first = buildTaraelogBrandConfig({ campaigns: [{ id: "other_campaign" }], fidelity: { keep: true } });
    const second = buildTaraelogBrandConfig(first);

    const ids = (second.campaigns as Array<{ id: string }>).map((item) => item.id);
    expect(ids).toEqual(["other_campaign", CAMPAIGN_ID]);
    expect(second.fidelity).toEqual({ keep: true });
  });

  it("does not promise what the landing page says it cannot do", () => {
    const raw = buildTaraelogBrandConfig({});
    // 모델에 그대로 들어가는 생성 지시문(시스템 프롬프트, 공식, 답글 문구)은 금지 약속을 담으면 안 된다.
    const generationText = JSON.stringify({ systemPrompt: raw.systemPrompt, campaigns: raw.campaigns });
    for (const phrase of FORBIDDEN_PROMISES) {
      expect(generationText, phrase).not.toContain(phrase);
    }
    // 무료 조건(Gemini 키 필요)을 숨기지 않는다.
    expect(String(raw.systemPrompt)).toContain("Gemini");
    const playbook = (raw.campaigns as Array<{ id: string; replyPlaybook: { cta: string } }>)
      .find((item) => item.id === CAMPAIGN_ID)?.replyPlaybook;
    expect(playbook?.cta).toContain("Gemini");
  });
});
