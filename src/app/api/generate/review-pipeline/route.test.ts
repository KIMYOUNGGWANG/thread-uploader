import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const brand = vi.hoisted(() => ({ id: "b1", slug: "cosmicpath", name: "CosmicPath", brandConfig: "{}" }));
vi.mock("@/lib/prisma", () => ({
  prisma: { brand: { findUniqueOrThrow: vi.fn(async () => ({ ...brand, brandConfig: '{"refetched":true}' })) } },
}));
vi.mock("@/lib/brand-access", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/brand-access")>();
  return { ...actual, requireBrandForCurrentUser: vi.fn(async () => ({ brand })) };
});
vi.mock("@/lib/length-experiment", () => ({ loadLengthExperimentState: vi.fn(async () => null) }));
vi.mock("@/lib/trend-radar/trend-radar-service", () => ({
  refreshBrandTrendRadar: vi.fn(async () => ({ slug: "cosmicpath", skeletons: 4, saved: 6 })),
}));
vi.mock("@/lib/generate-posts", () => ({
  generatePostsForBrand: vi.fn(async () => ({ ok: true, summary: { count: 3, failedCount: 0 } })),
}));

import { requireBrandForCurrentUser } from "@/lib/brand-access";
import { generatePostsForBrand } from "@/lib/generate-posts";
import { loadLengthExperimentState } from "@/lib/length-experiment";
import { refreshBrandTrendRadar } from "@/lib/trend-radar/trend-radar-service";
import { POST } from "./route";

const post = (body: Record<string, unknown>) =>
  POST(new NextRequest("http://localhost/api/generate/review-pipeline", { method: "POST", body: JSON.stringify(body) }));

describe("POST /api/generate/review-pipeline", () => {
  beforeEach(() => vi.clearAllMocks());

  it("refreshes a stale trend radar, then generates chained drafts into the approval queue", async () => {
    const res = await post({ brandId: "b1" });
    expect(res.status).toBe(200);
    expect(refreshBrandTrendRadar).toHaveBeenCalledOnce();
    const [usedBrand, input] = vi.mocked(generatePostsForBrand).mock.calls[0];
    expect(usedBrand.brandConfig).toBe('{"refetched":true}');
    expect(input).toMatchObject({ count: 3, draftChain: 3, initialStatus: "NEEDS_REVIEW", postCategory: "GROWTH" });
  });

  it("skips the harvest when the trend radar is under a day old", async () => {
    const trendRadar = { harvestedAt: new Date(Date.now() - 60_000).toISOString(), items: [] };
    vi.mocked(requireBrandForCurrentUser).mockResolvedValueOnce({ brand: { ...brand, brandConfig: JSON.stringify({ trendRadar }) } } as never);
    const res = await post({ brandId: "b1" });
    expect(res.status).toBe(200);
    expect(refreshBrandTrendRadar).not.toHaveBeenCalled();
    expect((await res.json()).trend).toBe("fresh");
  });

  it("refuses while the length experiment runs", async () => {
    vi.mocked(loadLengthExperimentState).mockResolvedValueOnce({ arm: "S" } as never);
    const res = await post({ brandId: "b1" });
    expect(res.status).toBe(409);
    expect(generatePostsForBrand).not.toHaveBeenCalled();
  });

  it("still generates when the harvest throws", async () => {
    vi.mocked(refreshBrandTrendRadar).mockRejectedValueOnce(new Error("search down"));
    const res = await post({ brandId: "b1" });
    expect(res.status).toBe(200);
    expect((await res.json()).trend).toBe("refresh failed");
  });

  it("rejects counts outside 1-5", async () => {
    expect((await post({ brandId: "b1", count: 9 })).status).toBe(400);
  });
});
