import { describe, expect, it } from "vitest";
import { buildXText, xWeightedLength } from "./x-text";

describe("xWeightedLength", () => {
  it("counts Latin as 1, Hangul as 2 and URLs as 23", () => {
    expect(xWeightedLength("abc")).toBe(3);
    expect(xWeightedLength("사주")).toBe(4);
    expect(xWeightedLength("see https://example.com/a/very/long/path")).toBe(4 + 23);
  });
});

describe("buildXText", () => {
  it("keeps whole paragraphs that fit and drops the rest", () => {
    const para = "가".repeat(60); // weight 120
    const text = buildXText(`${para}\n\n${para}\n\n${para}`);
    expect(text).toBe(`${para}\n\n${para}`);
    expect(xWeightedLength(text)).toBeLessThanOrEqual(280);
  });

  it("splits on thread separators", () => {
    expect(buildXText("첫 문단\n---\n둘째 문단")).toBe("첫 문단\n\n둘째 문단");
  });

  it("truncates a single oversized paragraph with an ellipsis", () => {
    const text = buildXText("나".repeat(200));
    expect(text.endsWith("…")).toBe(true);
    expect(xWeightedLength(text)).toBeLessThanOrEqual(280);
  });

  it("returns empty text for empty content", () => {
    expect(buildXText("  \n\n ")).toBe("");
  });
});
