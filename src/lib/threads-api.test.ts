import { describe, expect, it, vi } from "vitest";

process.env.ENCRYPTION_KEY = "test-encryption-key";

vi.mock("@/lib/prisma", () => ({ prisma: { brand: { findUnique: vi.fn() } } }));

import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/crypto";
import { fetchFollowersCountForBrand, getFreshBrandCredentials } from "./threads-api";

describe("getFreshBrandCredentials", () => {
  it("decrypts the stored token so callers get the real Threads token", async () => {
    vi.mocked(prisma.brand.findUnique).mockResolvedValue({
      accessToken: encrypt("THQAA-real"),
      threadsUserId: "u1",
      tokenExpiry: new Date(Date.now() + 50 * 24 * 60 * 60 * 1000),
    } as never);

    expect(await getFreshBrandCredentials("b1")).toEqual({ accessToken: "THQAA-real", userId: "u1" });
  });
});

describe("publishPostWithCredentials video", () => {
  it("creates a VIDEO container, waits for FINISHED, then publishes", async () => {
    vi.useFakeTimers();
    const calls: string[] = [];
    const statuses = ["IN_PROGRESS", "FINISHED"];
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      calls.push(url);
      if (url.includes("/threads_publish")) return new Response(JSON.stringify({ id: "media_1" }));
      if (url.includes("/threads?")) return new Response(JSON.stringify({ id: "container_1" }));
      return new Response(JSON.stringify({ status: statuses.shift() }));
    }));

    const { publishPostWithCredentials } = await import("./threads-api");
    const pending = publishPostWithCredentials("caption", { accessToken: "t", userId: "u" }, ["https://blob.example/v.mp4"]);
    await vi.runAllTimersAsync();

    expect(await pending).toBe("media_1");
    expect(calls[0]).toContain("media_type=VIDEO");
    expect(calls[0]).toContain("video_url=https%3A%2F%2Fblob.example%2Fv.mp4");
    expect(calls.filter((url) => url.includes("fields=status")).length).toBe(2);
    vi.useRealTimers();
  });

  it("fails fast when Threads reports a processing error", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ status: "ERROR", error_message: "bad codec" }))));
    const { waitForContainerReady } = await import("./threads-api");
    await expect(waitForContainerReady("c1", "t", { intervalMs: 1 })).rejects.toThrow("bad codec");
  });
});

describe("fetchFollowersCountForBrand", () => {
  it("reads the total_value of followers_count from user insights", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      expect(url).toContain("/u1/threads_insights?metric=followers_count");
      return new Response(JSON.stringify({ data: [{ name: "followers_count", period: "day", total_value: { value: 1842 } }] }));
    }));
    expect(await fetchFollowersCountForBrand("u1", "tok")).toBe(1842);
    vi.unstubAllGlobals();
  });

  it("returns null instead of 0 when the API rejects the token", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: { message: "Invalid OAuth access token" } }), { status: 400 })));
    expect(await fetchFollowersCountForBrand("u1", "bad")).toBeNull();
    vi.unstubAllGlobals();
  });
});
