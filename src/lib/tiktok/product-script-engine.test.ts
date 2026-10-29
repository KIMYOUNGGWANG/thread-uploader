import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDomainPreset } from "@/lib/domain-registry";
import { normalizeProductProfile } from "@/types/product-profile";
import {
  SAJU_TERMS,
  evaluateProductQuality,
  generateProductScript,
  resolveProductName,
  type ProductScriptCopy,
  type ProductScriptParams,
} from "./product-script-engine";

const messagesCreate = vi.hoisted(() => vi.fn());
vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = { create: messagesCreate };
  },
}));

const preset = getDomainPreset("product_growth");
const CATCHDEX = normalizeProductProfile({
  productName: "Catchdex",
  oneLineDescription: "흩어진 업무 요청을 한곳에 모아주는 도구",
  targetCustomer: "1인 메이커",
  offerPromise: "반복 업무 자동화",
});
const params: ProductScriptParams = { brandName: "catchdex", productProfile: CATCHDEX, preset, topic: preset.defaultTopics[0] };

const validCopy: ProductScriptCopy = {
  hookText: "요청 정리에 하루가 다 가는 이유?",
  hookSpoken: "요청 정리에 하루가 다 가는 이유, 따로 있어요.",
  answerSpoken: "Catchdex는 흩어진 요청을 한곳에 모아줘요.",
  answerScreen: "Catchdex = 요청 한곳에",
  proofSpoken: "반복되는 분류는 자동으로 끝나요.",
  proofScreen: ["분류 자동화", "하루 1시간 절약"],
  ctaSpoken: "프로필 링크에서 바로 써볼 수 있어요.",
  ctaScreen: "프로필 링크 → 무료로 시작",
  hashtags: ["생산성", "업무자동화", "1인창업"],
};

function claudeReturns(text: string) {
  messagesCreate.mockResolvedValueOnce({ content: [{ type: "text", text }], stop_reason: "end_turn" });
}

describe("generateProductScript", () => {
  beforeEach(() => messagesCreate.mockReset());
  afterEach(() => vi.unstubAllEnvs());

  it("builds a 4-scene product script without the API key", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    const script = await generateProductScript(params);
    expect(script.scenes.map((s) => s.type)).toEqual(["kinetic-card", "placeholder", "kinetic-card", "kinetic-card"]);
    expect(script.totalDurationSeconds).toBe(20);
    expect(script.scenes[1].spokenLine).toContain("Catchdex");
    expect(script.fullScript).not.toMatch(/사주|일간|명식/);
    expect(script.qualityReasons).toEqual([]);
    expect(script.qualityPass).toBe(true);
    expect(messagesCreate).not.toHaveBeenCalled();
  });

  it("does not repeat a hashtag that differs only in case", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    const script = await generateProductScript(params);
    expect(script.hashtags).toEqual(["Catchdex"]);
  });

  it("uses Claude copy when the key is set", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
    claudeReturns(JSON.stringify(validCopy));
    const script = await generateProductScript(params);
    expect(script.scenes[0].onScreenText[0]).toBe(validCopy.hookText);
    expect(script.cta).toBe(validCopy.ctaScreen);
    expect(script.hashtags).toEqual(validCopy.hashtags);
    expect(script.qualityPass).toBe(true);
    const prompt = messagesCreate.mock.calls[0][0].messages[0].content as string;
    expect(prompt).toContain("Catchdex");
    expect(prompt).toContain("사주"); // listed as a forbidden term
  });

  it("fails the gate instead of throwing on weak Claude copy", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
    claudeReturns(JSON.stringify({ ...validCopy, hookText: "요청 정리에 하루가 통째로 날아가는 진짜 이유가 궁금하다면?", answerSpoken: "이 도구가 요청을 모아줘요." }));
    const script = await generateProductScript(params);
    expect(script.qualityPass).toBe(false);
    expect(script.qualityReasons?.length).toBeGreaterThanOrEqual(2);
  });

  it("keeps a short fallback hook when the target customer is long", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    const longCustomer = normalizeProductProfile({ ...CATCHDEX, targetCustomer: "매일 반복 업무에 시달리는 1인 쇼핑몰 운영자" });
    const script = await generateProductScript({ ...params, productProfile: longCustomer });
    expect(script.qualityReasons).toEqual([]);
  });

  it("strips # from Claude hashtags and gates saju hashtags", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
    claudeReturns(JSON.stringify({ ...validCopy, hashtags: ["#Catchdex", "사주"] }));
    const script = await generateProductScript(params);
    expect(script.hashtags).toEqual(["Catchdex", "사주"]);
    expect(script.qualityPass).toBe(false);
  });

  it("says the answer was cut off when Claude hits max_tokens", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
    messagesCreate.mockResolvedValueOnce({ content: [{ type: "text", text: '{"hookText": "요청' }], stop_reason: "max_tokens" });
    await expect(generateProductScript(params)).rejects.toThrow("잘렸");
    expect(messagesCreate.mock.calls[0][0].max_tokens).toBeGreaterThanOrEqual(4000);
  });

  it("rejects a malformed Claude response", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
    claudeReturns("not json");
    await expect(generateProductScript(params)).rejects.toThrow();
  });
});

describe("evaluateProductQuality", () => {
  it("fails when saju terms leak into a career brand script", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    const script = await generateProductScript(params);
    script.scenes[2].spokenLine = "올해 운세가 바뀌는 시기예요.";
    const forbidden = [...getDomainPreset("career_decision").forbiddenCrossDomainTerms, ...SAJU_TERMS];
    expect(evaluateProductQuality(script, "Catchdex", forbidden).qualityPass).toBe(false);
    vi.unstubAllEnvs();
  });
});

describe("evaluateProductQuality day-count wording", () => {
  it("allows a trial period like 7일간 but still blocks 일간 as a saju term", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    const script = await generateProductScript({ ...params, productProfile: normalizeProductProfile({ ...CATCHDEX, offerPromise: "7일간 무료로 써보세요" }) });
    expect(script.qualityReasons).toEqual([]);
    script.scenes[2].spokenLine = "갑목 일간이라면 더 잘 맞아요.";
    expect(evaluateProductQuality(script, "Catchdex", SAJU_TERMS).qualityPass).toBe(false);
    vi.unstubAllEnvs();
  });
});

describe("resolveProductName", () => {
  it("falls back to the brand name for an empty product profile", () => {
    expect(resolveProductName("catchdex", normalizeProductProfile({}))).toBe("catchdex");
    expect(resolveProductName("catchdex", CATCHDEX)).toBe("Catchdex");
  });
});
