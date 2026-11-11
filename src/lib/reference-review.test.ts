import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  viralExample: { findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn((args: unknown) => args) },
  $transaction: vi.fn(async (ops: unknown[]) => ops),
}));
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

import { ResourceNotFoundError } from "@/lib/brand-access";
import { applyDecision, dedupeBySourceKey, listReferencesForReview, setReferenceDecision, toReviewItem } from "@/lib/reference-review";
import { mergeStoredRawMetrics, readReferenceDecision, splitReferenceContent } from "@/lib/viral-analysis";

const row = (over: Partial<Parameters<typeof toReviewItem>[0]> = {}) => ({
  id: "e1", sourceKey: "k1", authorUsername: "someone", permalink: "https://www.threads.net/x", publishedAt: new Date("2026-11-01T00:00:00Z"),
  content: "첫 줄 훅\n\n본문 한 줄\n본문 두 줄", hookType: "question", emotionalDriver: "curiosity", structureType: "list", ctaType: "none",
  patternSummary: "question + curiosity + list", rawMetrics: JSON.stringify({ referenceScore: 42, timesSeen: 3, eligibleSource: true, whyItWorks: "공감" }), ...over,
});

describe("splitReferenceContent", () => {
  it("takes the first non-empty line as the hook and the rest as the body", () => {
    expect(splitReferenceContent("\n  훅  \n\n본문1\n본문2")).toEqual({ hook: "훅", body: "본문1\n본문2" });
  });
  it("handles an empty or one-line post", () => {
    expect(splitReferenceContent("  \n ")).toEqual({ hook: "", body: "" });
    expect(splitReferenceContent("훅만")).toEqual({ hook: "훅만", body: "" });
  });
});

describe("readReferenceDecision", () => {
  it("reads only approved or rejected, anything else is undecided", () => {
    expect(readReferenceDecision('{"referenceDecision":"approved"}')).toBe("approved");
    expect(readReferenceDecision('{"referenceDecision":"rejected"}')).toBe("rejected");
    expect(readReferenceDecision('{"referenceDecision":"maybe"}')).toBeNull();
    expect(readReferenceDecision("{oops")).toBeNull();
    expect(readReferenceDecision(null)).toBeNull();
  });
});

describe("re-harvest keeps the decision", () => {
  // Without PERSISTED_RAW_KEYS the next 4h harvest would silently un-reject a post.
  it("mergeStoredRawMetrics carries referenceDecision over", () => {
    const { merged } = mergeStoredRawMetrics(JSON.stringify({ timesSeen: 2, referenceDecision: "rejected" }), { searchRank: 3 });
    expect(merged.referenceDecision).toBe("rejected");
  });
});

describe("toReviewItem / dedupeBySourceKey", () => {
  it("builds the breakdown from columns and rawMetrics", () => {
    expect(toReviewItem(row())).toMatchObject({
      hook: "첫 줄 훅", body: "본문 한 줄\n본문 두 줄", hookType: "question", referenceScore: 42, timesSeen: 3, eligibleSource: true, whyItWorks: "공감", decision: null,
    });
  });
  it("survives broken rawMetrics", () => {
    expect(toReviewItem(row({ rawMetrics: "nope" }))).toMatchObject({ referenceScore: null, timesSeen: 0, eligibleSource: false, decision: null });
  });
  it("keeps the first row per sourceKey", () => {
    expect(dedupeBySourceKey([{ sourceKey: "a", n: 1 }, { sourceKey: "a", n: 2 }, { sourceKey: "b", n: 3 }]).map((r) => r.n)).toEqual([1, 3]);
  });
});

describe("applyDecision", () => {
  it("sets the decision and keeps the other keys", () => {
    expect(JSON.parse(applyDecision('{"timesSeen":3,"whyItWorks":"x"}', "rejected"))).toEqual({ timesSeen: 3, whyItWorks: "x", referenceDecision: "rejected" });
  });
  it("null clears it", () => {
    expect(JSON.parse(applyDecision('{"timesSeen":3,"referenceDecision":"approved"}', null))).toEqual({ timesSeen: 3 });
  });
  it("starts from an empty object when rawMetrics is malformed", () => {
    expect(JSON.parse(applyDecision("{oops", "approved"))).toEqual({ referenceDecision: "approved" });
  });
});

describe("setReferenceDecision", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects an example that belongs to another brand", async () => {
    prismaMock.viralExample.findUnique.mockResolvedValue({ brandId: "other", sourceKey: "k1" });
    await expect(setReferenceDecision("b1", "e1", "rejected")).rejects.toBeInstanceOf(ResourceNotFoundError);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("rejects an unknown id", async () => {
    prismaMock.viralExample.findUnique.mockResolvedValue(null);
    await expect(setReferenceDecision("b1", "nope", "approved")).rejects.toBeInstanceOf(ResourceNotFoundError);
  });

  it("writes the decision on every sibling row of the same post and keeps their other keys", async () => {
    prismaMock.viralExample.findUnique.mockResolvedValue({ brandId: "b1", sourceKey: "k1" });
    prismaMock.viralExample.findMany.mockResolvedValue([
      { id: "e1", rawMetrics: '{"timesSeen":2}' },
      { id: "e2", rawMetrics: '{"timesSeen":5,"replayAttemptedAt":"2026-11-01T00:00:00Z"}' },
    ]);
    await setReferenceDecision("b1", "e1", "rejected");

    expect(prismaMock.viralExample.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { brandId: "b1", sourceKey: "k1" } }));
    const writes = prismaMock.viralExample.update.mock.calls.map(([args]) => args as { where: { id: string }; data: { rawMetrics: string } });
    expect(writes.map((w) => w.where.id)).toEqual(["e1", "e2"]);
    expect(JSON.parse(writes[1].data.rawMetrics)).toEqual({ timesSeen: 5, replayAttemptedAt: "2026-11-01T00:00:00Z", referenceDecision: "rejected" });
  });
});

describe("listReferencesForReview", () => {
  beforeEach(() => vi.clearAllMocks());

  it("excludes shorts and manual posts, collapses per-keyword rows and applies the limit", async () => {
    prismaMock.viralExample.findMany.mockResolvedValue([row({ id: "a", sourceKey: "k1" }), row({ id: "a2", sourceKey: "k1" }), row({ id: "b", sourceKey: "k2" }), row({ id: "c", sourceKey: "k3" })]);
    const items = await listReferencesForReview("b1", 2);

    expect(prismaMock.viralExample.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { brandId: "b1", source: { notIn: ["youtube_shorts", "manual_x"] } } }));
    expect(items.map((item) => item.id)).toEqual(["a", "b"]);
  });
});
