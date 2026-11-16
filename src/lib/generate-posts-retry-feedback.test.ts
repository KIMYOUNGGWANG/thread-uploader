import { describe, expect, it } from "vitest";
import { formatQualityFeedback } from "./generate-posts";

describe("formatQualityFeedback", () => {
  // 2026-11-16: retries told only "reply-burden CTA 포함" kept ending on "댓글 남겨주세요" and the draft was dropped.
  it("spells out which sentences to drop for a reply-burden failure", () => {
    const lines = formatQualityFeedback(["reply-burden CTA 포함"]);
    expect(lines.at(-1)).toContain("댓글 남겨줘");
    expect(lines.at(-1)).toContain("첫 댓글");
  });

  it("passes other reasons through unchanged", () => {
    expect(formatQualityFeedback(["첫 줄이 너무 김"]).at(-1)).toBe("- 첫 줄이 너무 김");
    expect(formatQualityFeedback([])).toEqual([]);
  });
});
