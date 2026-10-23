import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({ brand: { findUnique: vi.fn(), update: vi.fn() } }));
const refreshToken = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/instagram-oauth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/instagram-oauth")>()),
  refreshInstagramLongLivedToken: refreshToken,
}));

import { encrypt } from "@/lib/crypto";
import {
  createReelsContainer,
  getContainerStatus,
  getFreshInstagramCredentials,
  getRemainingPublishQuota,
  publishContainer,
  refreshBrandInstagramToken,
} from "@/lib/instagram-api";

const BASE = "https://graph.instagram.com/v26.0";
const DAY_MS = 24 * 60 * 60 * 1000;
const credentials = { accessToken: "tok", userId: "17841" };

function stubFetch(body: unknown, status = 200) {
  const fetchMock = vi.fn<typeof fetch>(async () => new Response(JSON.stringify(body), { status }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function firstCall(fetchMock: ReturnType<typeof stubFetch>): [string, RequestInit] {
  return fetchMock.mock.calls[0] as unknown as [string, RequestInit];
}

beforeEach(() => {
  process.env.ENCRYPTION_KEY ??= "0".repeat(64);
  vi.clearAllMocks();
});
afterEach(() => vi.unstubAllGlobals());

describe("instagram api", () => {
  it("creates a REELS container with share_to_feed", async () => {
    const fetchMock = stubFetch({ id: "c1" });
    const id = await createReelsContainer(credentials, { videoUrl: "https://v/x.mp4", caption: "hi" });
    const [url, init] = firstCall(fetchMock);
    const body = new URLSearchParams(String(init.body));
    expect(id).toBe("c1");
    expect(url).toBe(`${BASE}/17841/media`);
    expect(init.method).toBe("POST");
    expect(body.get("media_type")).toBe("REELS");
    expect(body.get("video_url")).toBe("https://v/x.mp4");
    expect(body.get("caption")).toBe("hi");
    expect(body.get("share_to_feed")).toBe("true");
    expect(body.get("access_token")).toBe("tok");
  });

  it("throws a staged error when container creation fails", async () => {
    stubFetch({ error: { message: "bad video" } }, 400);
    await expect(createReelsContainer(credentials, { videoUrl: "u", caption: "c" })).rejects.toThrow(
      "Instagram API Error (container creation): bad video",
    );
  });

  it("maps status_code to InstagramContainerStatus", async () => {
    const fetchMock = stubFetch({ status_code: "FINISHED" });
    expect(await getContainerStatus("c1", "tok")).toBe("FINISHED");
    const [url, init] = firstCall(fetchMock);
    expect(url).toBe(`${BASE}/c1?fields=status_code`);
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer tok");
  });

  it("throws on unknown status_code", async () => {
    stubFetch({ status_code: "WEIRD" });
    await expect(getContainerStatus("c1", "tok")).rejects.toThrow("Instagram API Error (status check)");
  });

  it("publishes with creation_id", async () => {
    const fetchMock = stubFetch({ id: "m1" });
    expect(await publishContainer(credentials, "c1")).toBe("m1");
    const [url, init] = firstCall(fetchMock);
    expect(url).toBe(`${BASE}/17841/media_publish`);
    expect(init.method).toBe("POST");
    expect(new URLSearchParams(String(init.body)).get("creation_id")).toBe("c1");
  });

  it("returns remaining quota as quota_total - quota_usage", async () => {
    const fetchMock = stubFetch({ data: [{ quota_usage: 3, config: { quota_total: 50 } }] });
    expect(await getRemainingPublishQuota(credentials)).toBe(47);
    expect(firstCall(fetchMock)[0]).toBe(`${BASE}/17841/content_publishing_limit?fields=quota_usage,config`);
  });

  it("returns null quota when the response shape is unexpected or the request fails", async () => {
    stubFetch({ data: [] });
    expect(await getRemainingPublishQuota(credentials)).toBeNull();
    stubFetch({ data: [{ quota_usage: "3", config: {} }] });
    expect(await getRemainingPublishQuota(credentials)).toBeNull();
    stubFetch({ error: { message: "nope" } }, 500);
    expect(await getRemainingPublishQuota(credentials)).toBeNull();
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("network"); }));
    expect(await getRemainingPublishQuota(credentials)).toBeNull();
  });
});

describe("getFreshInstagramCredentials", () => {
  const connected = (daysLeft: number) => ({
    instagramAccessToken: encrypt("stored"),
    instagramUserId: "17841",
    instagramTokenExpiry: new Date(Date.now() + daysLeft * DAY_MS),
  });

  it("returns null credentials when token is missing or expired", async () => {
    prismaMock.brand.findUnique.mockResolvedValueOnce({ instagramAccessToken: null, instagramUserId: null, instagramTokenExpiry: null });
    expect(await getFreshInstagramCredentials("b1")).toBeNull();
    prismaMock.brand.findUnique.mockResolvedValueOnce(connected(-1));
    expect(await getFreshInstagramCredentials("b1")).toBeNull();
    prismaMock.brand.findUnique.mockResolvedValueOnce(null);
    expect(await getFreshInstagramCredentials("b1")).toBeNull();
    expect(refreshToken).not.toHaveBeenCalled();
  });

  it("returns the stored token when it is not due for refresh", async () => {
    prismaMock.brand.findUnique.mockResolvedValueOnce(connected(30));
    expect(await getFreshInstagramCredentials("b1")).toEqual({ accessToken: "stored", userId: "17841" });
    expect(refreshToken).not.toHaveBeenCalled();
  });

  it("refreshes and stores an encrypted token when due", async () => {
    prismaMock.brand.findUnique.mockResolvedValueOnce(connected(2));
    refreshToken.mockResolvedValue({ accessToken: "fresh", expiresIn: 5184000 });
    expect(await getFreshInstagramCredentials("b1")).toEqual({ accessToken: "fresh", userId: "17841" });
    const data = prismaMock.brand.update.mock.calls[0]?.[0].data;
    expect(data.instagramAccessToken).not.toBe("fresh");
    expect(data.instagramTokenExpiry).toBeInstanceOf(Date);
  });
});

describe("refreshBrandInstagramToken", () => {
  it("throws when the brand has no Instagram token", async () => {
    prismaMock.brand.findUnique.mockResolvedValueOnce({ instagramAccessToken: null });
    await expect(refreshBrandInstagramToken("b1")).rejects.toThrow("Instagram is not connected");
  });
});
