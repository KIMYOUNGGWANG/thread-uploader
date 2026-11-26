import { describe, expect, it, vi } from "vitest";
import { buildComposePrompt, composeDrafts, composeRaw } from "./compose";

const source = {
  title: "MS, 자체 AI 모델 7종 공개",
  url: "https://zdnet.co.kr/view/?no=1",
  text: "마이크로소프트는 이그나이트 2026 컨퍼런스에서 MAI 계열의 새로운 자체 AI 모델 7개를 공개했다.",
  operatorNote: "실무 자동화에 꼭 볼 기술",
  imageCount: 2,
};

const good = JSON.stringify({
  facts: [
    { text: "MS가 모델 7개 공개", evidence: "MAI 계열의 새로운 자체 AI 모델 7개를 공개했다" },
    { text: "지어낸 사실", evidence: "기사에 없는 문장입니다만" },
  ],
  telegram: "🧠 MS 자체 모델 7종\n\n• 이그나이트 2026에서 공개",
  threads: "MS가 자체 모델을 7개나 냈다.",
  kakao: "MS 자체 AI 모델 7종 공개 https://zdnet.co.kr/view/?no=1",
});

describe("buildComposePrompt", () => {
  it("carries the source, the operator note and the caption budget when images are attached", () => {
    const prompt = buildComposePrompt(source);
    expect(prompt).toContain(source.text);
    expect(prompt).toContain("실무 자동화에 꼭 볼 기술");
    expect(prompt).toContain("900자");
    expect(buildComposePrompt({ ...source, imageCount: 0 })).toContain("1,500자");
  });
});

describe("composeDrafts", () => {
  it("returns drafts per platform with facts checked against the source", async () => {
    const result = await composeDrafts(source, vi.fn(async () => `설명\n${good}`));
    expect(result?.drafts.threads).toBe("MS가 자체 모델을 7개나 냈다.");
    expect(result?.facts.map((fact) => fact.verified)).toEqual([true, false]);
  });

  it("retries once with feedback when the answer is malformed or a platform is missing", async () => {
    const complete = vi.fn()
      .mockResolvedValueOnce(JSON.stringify({ facts: [], telegram: "a", threads: "", kakao: "c" }))
      .mockResolvedValueOnce(good);
    const result = await composeDrafts(source, complete);
    expect(result).not.toBeNull();
    expect(complete).toHaveBeenCalledTimes(2);
    expect(complete.mock.calls[1][0]).toContain("이전 답의 문제");
  });

  it("gives up after two bad answers", async () => {
    expect(await composeDrafts(source, vi.fn(async () => "not json"))).toBeNull();
  });
});

describe("composeRaw", () => {
  it("uses the source text for every platform without facts", () => {
    expect(composeRaw("  원문 그대로  ")).toEqual({ facts: [], drafts: { telegram: "원문 그대로", threads: "원문 그대로", kakao: "원문 그대로" } });
  });
});
