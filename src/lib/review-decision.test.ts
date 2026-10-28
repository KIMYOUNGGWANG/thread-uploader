import { describe, expect, it } from "vitest";
import { normalizeReviewReason, reviewDecisionFor } from "@/lib/review-decision";

const post = { id: "p1", brandId: "b1", status: "NEEDS_REVIEW", formulaId: null, topic: null, hookType: null };

describe("normalizeReviewReason", () => {
  it("trims, caps at 200 chars, and turns blank or non-string input into null", () => {
    expect(normalizeReviewReason("  뻔함  ")).toBe("뻔함");
    expect(normalizeReviewReason("가".repeat(300))).toHaveLength(200);
    expect(normalizeReviewReason("   ")).toBeNull();
    expect(normalizeReviewReason(42)).toBeNull();
    expect(normalizeReviewReason(undefined)).toBeNull();
  });
});

describe("reviewDecisionFor", () => {
  it("counts approval only from NEEDS_REVIEW, and rejection from NEEDS_REVIEW or PENDING", () => {
    expect(reviewDecisionFor(post, "APPROVED", null)).not.toBeNull();
    expect(reviewDecisionFor({ ...post, status: "PENDING" }, "APPROVED", null)).toBeNull();
    expect(reviewDecisionFor({ ...post, status: "PENDING" }, "REJECTED", null)).not.toBeNull();
    expect(reviewDecisionFor({ ...post, status: "PUBLISHED" }, "REJECTED", null)).toBeNull();
    expect(reviewDecisionFor({ ...post, status: "ARCHIVED" }, "REJECTED", null)).toBeNull();
  });
});
