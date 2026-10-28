import { describe, expect, it } from "vitest";
import { interpretCommandLocally, parseCommandPlan } from "@/lib/command-plan";

const brands = [
  { id: "b1", slug: "cosmicpath", name: "CosmicPath" },
  { id: "b2", slug: "deokjil", name: "셀프덕질" },
];

describe("parseCommandPlan", () => {
  it("accepts a plan for one of the caller's brands", () => {
    expect(parseCommandPlan({ brandId: "b1", count: 3, hypothesis: " 연애 소재 " }, brands)).toEqual({
      brandId: "b1",
      count: 3,
      hypothesis: "연애 소재",
    });
  });

  it("rejects foreign brands, out-of-range counts and non-string hypotheses", () => {
    expect(parseCommandPlan({ brandId: "other", count: 3 }, brands)).toBeNull();
    expect(parseCommandPlan({ brandId: "b1", count: 7 }, brands)).toBeNull();
    expect(parseCommandPlan({ brandId: "b1", count: 0 }, brands)).toBeNull();
    expect(parseCommandPlan({ brandId: "b1", count: 2.5 }, brands)).toBeNull();
    expect(parseCommandPlan({ brandId: "b1", count: 2, hypothesis: 1 }, brands)).toBeNull();
    expect(parseCommandPlan("not an object", brands)).toBeNull();
  });
});

describe("interpretCommandLocally", () => {
  it("finds the brand by slug or name and reads the count", () => {
    expect(interpretCommandLocally("cosmicpath 연애 소재로 4개 만들어줘", brands)).toEqual({
      brandId: "b1",
      count: 4,
      hypothesis: "cosmicpath 연애 소재로 4개 만들어줘",
    });
    expect(interpretCommandLocally("셀프덕질 이번 주 스프린트", brands).brandId).toBe("b2");
  });

  it("defaults to 3 and caps at 6", () => {
    expect(interpretCommandLocally("cosmicpath 글 뽑아줘", brands).count).toBe(3);
    expect(interpretCommandLocally("cosmicpath 20개", brands).count).toBe(6);
  });

  it("throws when no brand is named", () => {
    expect(() => interpretCommandLocally("아무 브랜드나 3개", brands)).toThrow("브랜드");
  });
});
