import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const DAY_MS = 24 * 60 * 60 * 1000;
const brands = vi.hoisted(() => ({ list: [] as { id: string; slug: string; name: string; accessToken: string; tokenExpiry: Date }[] }));
const refreshBrandAccessToken = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({ prisma: { brand: { findMany: vi.fn(async () => brands.list) } } }));
vi.mock("@/lib/cron-auth", () => ({ verifyCronSecret: () => true }));
vi.mock("@/lib/alert-service", () => ({ sendSystemAlert: vi.fn(), checkTokenExpiryAlert: vi.fn() }));
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
});
