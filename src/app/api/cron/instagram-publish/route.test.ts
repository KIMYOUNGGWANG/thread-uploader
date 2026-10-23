import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

type TestBrand = { id: string; slug: string; name: string; brandConfig: string; instagramConnectedAt: Date | null };

const brands = vi.hoisted(() => ({ list: [] as TestBrand[] }));
const findMany = vi.hoisted(() => vi.fn());
const verifyCronSecret = vi.hoisted(() => vi.fn());
const getFreshInstagramCredentials = vi.hoisted(() => vi.fn());
const runInstagramReelsTick = vi.hoisted(() => vi.fn());
const sendSystemAlert = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({ prisma: { brand: { findMany } } }));
vi.mock("@/lib/cron-auth", () => ({ verifyCronSecret }));
vi.mock("@/lib/instagram-api", () => ({ getFreshInstagramCredentials }));
vi.mock("@/lib/instagram-reels-sync", () => ({ runInstagramReelsTick }));
vi.mock("@/lib/alert-service", () => ({ sendSystemAlert }));

import { GET, maxDuration } from "./route";

const connectedAt = new Date("2026-10-20T00:00:00Z");
const brand = (slug: string): TestBrand => ({ id: `id-${slug}`, slug, name: slug, brandConfig: "{}", instagramConnectedAt: connectedAt });
const tickResult = { advanced: 0, published: [], started: "p1", skippedStale: 0, failed: [] };
const request = (query = "") => new NextRequest(`http://localhost/api/cron/instagram-publish${query}`);

describe("instagram-publish cron", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    verifyCronSecret.mockReturnValue(true);
    findMany.mockImplementation(async () => brands.list);
    runInstagramReelsTick.mockResolvedValue(tickResult);
  });

  it("returns 401 without cron secret", async () => {
    verifyCronSecret.mockReturnValue(false);
    const response = await GET(request());
    expect(response.status).toBe(401);
    expect(findMany).not.toHaveBeenCalled();
    expect(runInstagramReelsTick).not.toHaveBeenCalled();
  });

  it("only loads Instagram-connected brands, filtered by the brands query", async () => {
    brands.list = [brand("cosmicpath")];
    getFreshInstagramCredentials.mockResolvedValue({ accessToken: "t", userId: "u" });
    await GET(request("?brands=cosmicpath, catchdex"));
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { instagramConnectedAt: { not: null }, slug: { in: ["cosmicpath", "catchdex"] } },
    }));
    expect(maxDuration).toBe(60);
  });

  it("skips brands with no Instagram credentials and still returns 200", async () => {
    brands.list = [brand("expired"), brand("cosmicpath")];
    getFreshInstagramCredentials.mockImplementation(async (brandId: string) =>
      brandId === "id-expired" ? null : { accessToken: "t", userId: "u" });

    const response = await GET(request());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(runInstagramReelsTick).toHaveBeenCalledTimes(1);
    expect(runInstagramReelsTick).toHaveBeenCalledWith(
      expect.objectContaining({ id: "id-cosmicpath", instagramConnectedAt: connectedAt }),
      { accessToken: "t", userId: "u" },
      expect.any(Date),
    );
    expect(body.results).toEqual([
      { slug: "expired", skipped: "not_connected" },
      { slug: "cosmicpath", ...tickResult },
    ]);
  });

  it("one brand throwing does not stop the others", async () => {
    brands.list = [brand("broken"), brand("cosmicpath")];
    getFreshInstagramCredentials.mockResolvedValue({ accessToken: "t", userId: "u" });
    runInstagramReelsTick.mockImplementation(async (target: TestBrand) => {
      if (target.slug === "broken") throw new Error("db down");
      return tickResult;
    });

    const response = await GET(request());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(runInstagramReelsTick).toHaveBeenCalledTimes(2);
    expect(sendSystemAlert).toHaveBeenCalledTimes(1);
    expect(sendSystemAlert).toHaveBeenCalledWith(expect.objectContaining({ level: "error", brandName: "broken" }));
    expect(body.results).toEqual([
      { slug: "broken", error: "db down" },
      { slug: "cosmicpath", ...tickResult },
    ]);
  });
});
