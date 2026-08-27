import { describe, expect, it } from "vitest";
import {
  isMultiPartThread,
  splitContentIntoThreadParts,
  THREADS_SINGLE_MAX_LENGTH,
} from "./thread-splitter";

describe("thread-splitter", () => {
  it("recognizes single post vs multi-part thread", () => {
    expect(isMultiPartThread("짧은 글입니다.")).toBe(false);
    expect(isMultiPartThread("a".repeat(500))).toBe(false);
    expect(isMultiPartThread("a".repeat(501))).toBe(true);
  });

  it("returns single post untouched if <= 500 characters", () => {
    const text = "이것은 500자 이하의 짧은 단일 포스트입니다. 별도의 분할이 일어나지 않아야 합니다.";
    const parts = splitContentIntoThreadParts(text);
    expect(parts).toHaveLength(1);
    expect(parts[0]).toBe(text);
  });

  it("splits a ~700 char post into 2 parts with 1/2 and 2/2 prefix", () => {
    const paragraph1 = "첫 번째 문단입니다. ".repeat(20); // ~220 chars
    const paragraph2 = "두 번째 문단입니다. ".repeat(20); // ~220 chars
    const paragraph3 = "세 번째 문단입니다. ".repeat(20); // ~220 chars
    const fullText = `${paragraph1}\n\n${paragraph2}\n\n${paragraph3}`;
    expect(fullText.length).toBeGreaterThan(THREADS_SINGLE_MAX_LENGTH);

    const parts = splitContentIntoThreadParts(fullText);
    expect(parts.length).toBeGreaterThanOrEqual(2);
    expect(parts.length).toBeLessThanOrEqual(5);

    expect(parts[0]).toMatch(/^1\/\d+\n\n/);
    expect(parts[1]).toMatch(/^2\/\d+\n\n/);

    // Each part must be within safe length (<= 500)
    for (const part of parts) {
      expect(part.length).toBeLessThanOrEqual(500);
    }
  });

  it("supports parentheses and brackets numbering styles", () => {
    const longText = "테스트 문단 내용입니다. ".repeat(40);
    const bracketParts = splitContentIntoThreadParts(longText, { numberingStyle: "brackets" });
    expect(bracketParts[0]).toMatch(/^\[1\/\d+\]\n\n/);

    const parenParts = splitContentIntoThreadParts(longText, { numberingStyle: "parentheses" });
    expect(parenParts[0]).toMatch(/^\(1\/\d+\)\n\n/);
  });

  it("caps maximum parts to 5 even for very long texts", () => {
    const extremelyLongText = "매우 긴 본문입니다. ".repeat(250); // ~2700 chars
    const parts = splitContentIntoThreadParts(extremelyLongText, { maxParts: 5 });
    expect(parts.length).toBeLessThanOrEqual(5);
    for (const part of parts) {
      expect(part.length).toBeLessThanOrEqual(500);
    }
  });
});
