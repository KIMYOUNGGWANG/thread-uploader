import { describe, expect, it } from "vitest";
import { checkVariant, findUnsupportedNumbers, telegramLimit, verifyFacts } from "./verify";

const source = `마이크로소프트는 이그나이트 2026 컨퍼런스에서   MAI 계열의 새로운 자체 AI 모델 7개를 공개했다.
MAI Code 2 모델의 가격은 100만 토큰당 2.50달러다. 매출은 1,200억 원을 넘었다.`;

describe("verifyFacts", () => {
  it("marks a fact verified only when its evidence appears in the source (whitespace-insensitive)", () => {
    const facts = verifyFacts(
      [
        { text: "MS가 모델 7개 공개", evidence: "이그나이트 2026 컨퍼런스에서 MAI 계열의" },
        { text: "가격은 3달러", evidence: "100만 토큰당 3.00달러다" },
        { text: "근거 너무 짧음", evidence: "MAI" },
      ],
      source,
    );
    expect(facts.map((fact) => fact.verified)).toEqual([true, false, false]);
  });

  it("drops malformed entries", () => {
    expect(verifyFacts([{ text: "", evidence: "x" }, { text: "ok", evidence: "" }] as never, source)).toEqual([
      { text: "ok", evidence: "", verified: false },
    ]);
  });
});

describe("findUnsupportedNumbers", () => {
  it("flags multi-digit numbers the source never mentions, ignoring commas, single digits and urls", () => {
    const text = "가격 2.50달러, 매출 1200억 원, 모델 7개, 출시 2027년. 원문 https://zdnet.co.kr/view/?no=20261119";
    expect(findUnsupportedNumbers(text, source)).toEqual(["2027"]);
  });
});

describe("telegramLimit", () => {
  it("uses the caption limit when images are attached", () => {
    expect(telegramLimit(0)).toBe(4096);
    expect(telegramLimit(1)).toBe(1024);
  });
});

describe("checkVariant", () => {
  it("blocks empty text and text over the platform limit", () => {
    expect(checkVariant({ platform: "telegram", text: "  ", imageCount: 0, sourceText: source }).blockers).not.toHaveLength(0);
    expect(checkVariant({ platform: "telegram", text: "가".repeat(1025), imageCount: 2, sourceText: source }).blockers[0]).toMatch(/1024/);
    expect(checkVariant({ platform: "telegram", text: "가".repeat(1025), imageCount: 0, sourceText: source }).blockers).toEqual([]);
    expect(checkVariant({ platform: "threads", text: "가".repeat(501), imageCount: 0, sourceText: source }).blockers.join()).toMatch(/500/);
  });

  it("applies the Threads safety gate: shadowban-suspected accounts cannot post news", () => {
    const check = checkVariant({
      platform: "threads",
      text: "MS가 새 AI 모델 7개를 공개했다.",
      imageCount: 0,
      sourceText: source,
      threadsAccountHealth: { status: "SHADOWBAN_SUSPECTED" },
    });
    expect(check.blockers.join()).toMatch(/섀도우밴/);
  });

  it("only warns about unsupported numbers", () => {
    const check = checkVariant({ platform: "kakao", text: "출시는 2027년", imageCount: 0, sourceText: source });
    expect(check.blockers).toEqual([]);
    expect(check.warnings[0]).toMatch(/2027/);
  });
});
