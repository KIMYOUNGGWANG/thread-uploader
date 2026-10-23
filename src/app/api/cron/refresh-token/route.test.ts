import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
type TestBrand = {
  id: string; slug: string; name: string; accessToken: string; tokenExpiry: Date;
  instagramAccessToken?: string; instagramTokenExpiry?: Date;
};
const brands = vi.hoisted(() => ({ list: [] as TestBrand[] }));
const refreshBrandAccessToken = vi.hoisted(() => vi.fn());
const refreshBrandInstagramToken = vi.hoisted(() => vi.fn());
const sendSystemAlert = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({ prisma: { brand: { findMany: vi.fn(async () => brands.list) } } }));
vi.mock("@/lib/cron-auth", () => ({ verifyCronSecret: () => true }));
vi.mock("@/lib/alert-service", () => ({ sendSystemAlert, checkTokenExpiryAlert: vi.fn() }));
vi.mock("@/lib/instagram-api", () => ({ refreshBrandInstagramToken }));
vi.mock("@/lib/threads-api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/threads-api")>();
  return {
    ...actual,
    initializeTokensInDB: vi.fn(),
    getTokenStatus: vi.fn(async () => ({ hasToken: false })),
    shouldRefreshToken: vi.fn(),
    refreshAccessToken: vi.fn(),
    refreshBrandAccessToken,
  };
});

import { GET } from "./route";

const brand = (slug: string, daysLeft: number) => ({
  id: slug, slug, name: slug, accessToken: "token", tokenExpiry: new Date(Date.now() + daysLeft * DAY_MS),
});
const instagramBrand = (slug: string, hoursLeft: number): TestBrand => ({
  ...brand(slug, 20), instagramAccessToken: "enc", instagramTokenExpiry: new Date(Date.now() + hoursLeft * HOUR_MS),
});
const request = () => new NextRequest("http://localhost/api/cron/refresh-token");

describe("refresh-token cron", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 500 when a still-valid token fails to refresh, so the scheduler run goes red", async () => {
    brands.list = [brand("cosmicpath", 5)];
    refreshBrandAccessToken.mockRejectedValue(new Error("Invalid OAuth access token"));
    const response = await GET(request());
    expect(response.status).toBe(500);
    expect((await response.json()).success).toBe(false);
  });

  it("stays 200 for already-expired tokens and flags them for reconnect without retrying", async () => {
    brands.list = [brand("catchdex", -30), brand("cosmicpath", 20)];
    const response = await GET(request());
    expect(response.status).toBe(200);
    expect(refreshBrandAccessToken).not.toHaveBeenCalled();
    expect((await response.json()).refreshResults[0]).toMatchObject({ slug: "catchdex", needsReconnect: true });
  });

  it("refreshes an Instagram token that is due and skips expired ones", async () => {
    brands.list = [instagramBrand("due", 5 * 24), instagramBrand("expired", -24)];
    refreshBrandInstagramToken.mockResolvedValue({ accessToken: "new", expiresIn: 5184000 });
    const response = await GET(request());
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(refreshBrandInstagramToken).toHaveBeenCalledTimes(1);
    expect(refreshBrandInstagramToken).toHaveBeenCalledWith("due");
    expect(body.instagramRefreshResults[0]).toMatchObject({ slug: "due", success: true });
    expect(body.instagramRefreshResults[1]).toMatchObject({ slug: "expired", instagramNeedsReconnect: true });
  });

  it("returns 500 and alerts when an Instagram refresh fails", async () => {
    brands.list = [instagramBrand("due", 5 * 24)];
    refreshBrandInstagramToken.mockRejectedValue(new Error("Instagram API Error (refresh): bad"));
    const response = await GET(request());
    expect(response.status).toBe(500);
    expect(sendSystemAlert).toHaveBeenCalledTimes(1);
  });

  it("alerts once for an Instagram token that expired within the last 24h", async () => {
    brands.list = [instagramBrand("fresh-expiry", -2), instagramBrand("old-expiry", -72)];
    const response = await GET(request());
    expect(response.status).toBe(200);
    expect(sendSystemAlert).toHaveBeenCalledTimes(1);
    expect(sendSystemAlert).toHaveBeenCalledWith(expect.objectContaining({ brandName: "fresh-expiry" }));
    expect(refreshBrandInstagramToken).not.toHaveBeenCalled();
  });
});
