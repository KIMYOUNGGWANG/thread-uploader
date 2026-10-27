import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Brand } from "@prisma/client";

const mocks = vi.hoisted(() => ({
  countPosts: vi.fn(),
  loadSource: vi.fn(),
  markAttempted: vi.fn(async () => undefined),
  generate: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: { post: { count: mocks.countPosts } } }));
vi.mock("@/lib/reference-replay", () => ({ loadReferenceReplaySource: mocks.loadSource, markReferenceAttempted: mocks.markAttempted }));
vi.mock("@/lib/generate-posts", () => ({ generatePostsForBrand: mocks.generate }));

import { refillReferenceReplay } from "@/lib/reference-replay-refill";

const now = new Date("2026-10-27T03:00:00.000Z");
const brandWith = (keywords: string[]) => ({ id: "b1", slug: "cosmicpath", brandConfig: JSON.stringify({ viralDiscovery: { keywords } }) }) as unknown as Brand;
const source = { id: "ex_1", content: "원문 글", authorUsername: "a", publishedAt: null, rawMetrics: "{}" };
const okSummary = (count: number, failureReasons: string[] = []) => ({ ok: true, summary: { count, failedCount: 0, failureReasons } });

describe("refillReferenceReplay", () => {
  beforeEach(() => {
    mocks.countPosts.mockReset().mockResolvedValue(0);
    mocks.loadSource.mockReset().mockResolvedValue(source);
    mocks.markAttempted.mockClear();
    mocks.generate.mockReset().mockResolvedValue(okSummary(1));
  });

  it("generates one draft when nothing was made today and none is pending", async () => {
    const result = await refillReferenceReplay(brandWith(["운세"]), now);

    expect(result).toEqual({ generated: 1, sourceId: "ex_1" });
    expect(mocks.markAttempted).toHaveBeenCalledWith("ex_1", now);
    expect(mocks.generate).toHaveBeenCalledWith(
      expect.objectContaining({ id: "b1" }),
      { count: 1, insertAtFront: false, requestedCampaignId: null, approvedCampaignStart: false, postCategory: "GROWTH", referenceReplay: source },
    );
  });

  it("skips with no_keywords when the brand has no keywords", async () => {
    expect(await refillReferenceReplay(brandWith([]), now)).toEqual({ generated: 0, skipped: "no_keywords" });
    expect(mocks.generate).not.toHaveBeenCalled();
    expect(mocks.countPosts).not.toHaveBeenCalled();
  });

  it("skips when a ref_replay was created today in any status", async () => {
    mocks.countPosts.mockResolvedValueOnce(1);
    expect(await refillReferenceReplay(brandWith(["운세"]), now)).toEqual({ generated: 0, skipped: "already_today" });
    const [args] = mocks.countPosts.mock.calls[0] as unknown as [{ where: { formulaId: string; status?: unknown; createdAt: { gte: Date } } }];
    expect(args.where.formulaId).toBe("ref_replay");
    expect(args.where.status).toBeUndefined();
    expect(args.where.createdAt.gte.toISOString()).toBe("2026-10-26T15:00:00.000Z"); // KST day start
    expect(mocks.generate).not.toHaveBeenCalled();
  });

  it("skips when a ref_replay is still PENDING but not when it is NEEDS_REVIEW", async () => {
    mocks.countPosts.mockResolvedValueOnce(0).mockResolvedValueOnce(1);
    expect(await refillReferenceReplay(brandWith(["운세"]), now)).toEqual({ generated: 0, skipped: "pending_in_queue" });
    expect(mocks.countPosts.mock.calls[1]).toEqual([{ where: { brandId: "b1", formulaId: "ref_replay", status: "PENDING" } }]);
    expect(mocks.generate).not.toHaveBeenCalled();

    mocks.countPosts.mockReset().mockResolvedValue(0); // NEEDS_REVIEW does not match status PENDING
    expect(await refillReferenceReplay(brandWith(["운세"]), now)).toEqual({ generated: 1, sourceId: "ex_1" });
  });

  it("skips with no_source when nothing qualifies or the source text is blank", async () => {
    mocks.loadSource.mockResolvedValueOnce(null);
    expect(await refillReferenceReplay(brandWith(["운세"]), now)).toEqual({ generated: 0, skipped: "no_source" });
    mocks.loadSource.mockResolvedValueOnce({ ...source, content: "  \n " });
    expect(await refillReferenceReplay(brandWith(["운세"]), now)).toEqual({ generated: 0, skipped: "no_source" });
    expect(mocks.generate).not.toHaveBeenCalled();
    expect(mocks.markAttempted).not.toHaveBeenCalled();
  });

  it("marks the source attempted even when the draft is dropped", async () => {
    mocks.generate.mockResolvedValue(okSummary(0, ["quality gate", "similar"]));
    expect(await refillReferenceReplay(brandWith(["운세"]), now)).toEqual({ generated: 0, skipped: "dropped", reason: "quality gate; similar" });
    expect(mocks.markAttempted).toHaveBeenCalledWith("ex_1", now);
  });

  it("reports a not-ok generation result as dropped with its error", async () => {
    mocks.generate.mockResolvedValue({ ok: false, error: "not ready" });
    expect(await refillReferenceReplay(brandWith(["운세"]), now)).toEqual({ generated: 0, skipped: "dropped", reason: "not ready" });
  });
});
