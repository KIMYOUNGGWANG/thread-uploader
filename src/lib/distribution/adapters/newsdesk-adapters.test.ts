import { afterEach, describe, expect, it, vi } from "vitest";
import { ChannelApiError } from "../http";
import { telegramAdapter, telegramPostUrl } from "./telegram";
import { threadsAdapter } from "./threads";
import type { UploadJob } from "./types";

const TOKEN = "123456:SECRET-BOT-TOKEN";
const tgCreds = { accessToken: TOKEN, externalUserId: "@newsdesk_test", handle: "@newsdesk_test" };
const thCreds = { accessToken: "th-token", externalUserId: "th-user", handle: null };
const job = (over: Partial<UploadJob> = {}): UploadJob => ({
  id: "u1", kind: "post", caption: "뉴스 원고", mediaUrls: [], privacy: "public", externalId: null, platformData: {}, ...over,
});
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const sentBody = (fetchMock: ReturnType<typeof vi.fn>, index = 0) => JSON.parse(fetchMock.mock.calls[index][1].body as string);

afterEach(() => vi.unstubAllGlobals());

describe("telegramAdapter", () => {
  it.each([
    [[], "sendMessage"],
    [["https://b/1.png"], "sendPhoto"],
    [["https://b/1.png", "https://b/2.png", "https://b/3.png"], "sendMediaGroup"],
  ])("makes exactly one call for %j images (%s)", async (mediaUrls, method) => {
    const fetchMock = vi.fn().mockResolvedValueOnce(json({ ok: true, result: method === "sendMediaGroup" ? [{ message_id: 7 }, { message_id: 8 }] : { message_id: 7 } }));
    vi.stubGlobal("fetch", fetchMock);
    const step = await telegramAdapter.start(job({ mediaUrls }), tgCreds);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(`https://api.telegram.org/bot${TOKEN}/${method}`);
    expect(step).toMatchObject({ state: "published", externalId: "@newsdesk_test:7", externalUrl: "https://t.me/newsdesk_test/7" });
    if (method === "sendMediaGroup") {
      const { media } = sentBody(fetchMock);
      expect(media).toHaveLength(3);
      expect(media[0]).toEqual({ type: "photo", media: "https://b/1.png", caption: "뉴스 원고" });
      expect(media[1].caption).toBeUndefined();
    }
  });

  it("refuses over-limit text before sending anything", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(telegramAdapter.start(job({ caption: "가".repeat(1025), mediaUrls: ["https://b/1.png"] }), tgCreds)).rejects.toMatchObject({ permanent: true });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("retries only an explicit 429", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(json({ ok: false, error_code: 429, description: "Too Many Requests: retry after 5" }, 429)));
    const error = await telegramAdapter.start(job(), tgCreds).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ChannelApiError);
    expect(error).toMatchObject({ permanent: false, status: 429 });
  });

  it("keeps Telegram's description for a 400 and fails permanently", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(json({ ok: false, error_code: 400, description: "Bad Request: chat not found" }, 400)));
    await expect(telegramAdapter.start(job(), tgCreds)).rejects.toMatchObject({ permanent: true, message: expect.stringContaining("chat not found") });
  });

  it.each([
    ["a network error", () => Promise.reject(new TypeError(`fetch failed https://api.telegram.org/bot${TOKEN}/sendMessage`))],
    ["a 502", () => Promise.resolve(new Response("bad gateway", { status: 502 }))],
    ["an unreadable body", () => Promise.resolve(new Response("<html>", { status: 200 }))],
  ])("treats %s after sending as permanent 'delivery uncertain' and never leaks the token", async (_label, impl) => {
    vi.stubGlobal("fetch", vi.fn(impl));
    const error = (await telegramAdapter.start(job(), tgCreds).catch((e: unknown) => e)) as ChannelApiError;
    expect(error.permanent).toBe(true);
    expect(error.message).toContain("확인 필요");
    expect(error.message).not.toContain(TOKEN);
    expect(error.message).not.toContain("SECRET");
  });

  it("counts an ok response as posted even when the message id is missing", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(json({ ok: true, result: true })));
    expect(await telegramAdapter.start(job(), tgCreds)).toMatchObject({ state: "published", externalId: "@newsdesk_test:unknown", externalUrl: null });
  });

  it("links only public channels", () => {
    expect(telegramPostUrl("@chan", 3)).toBe("https://t.me/chan/3");
    expect(telegramPostUrl(null, 3)).toBeNull();
  });
});

describe("threadsAdapter", () => {
  it("start only creates a container (carousel for several images)", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(json({ id: "item1" }))
      .mockResolvedValueOnce(json({ id: "item2" }))
      .mockResolvedValueOnce(json({ id: "carousel1" }));
    vi.stubGlobal("fetch", fetchMock);
    const step = await threadsAdapter.start(job({ mediaUrls: ["https://b/1.png", "https://b/2.png"] }), thCreds);
    expect(step).toEqual({ state: "processing", platformData: { containerId: "carousel1" }, retryAfterMs: 3000 });
    expect(fetchMock.mock.calls.every(([url]) => !String(url).includes("threads_publish"))).toBe(true);
    expect(String(fetchMock.mock.calls[2][0])).toContain("children=item1%2Citem2");
  });

  it("refuses text over 500 chars before calling Threads", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(threadsAdapter.start(job({ caption: "가".repeat(501) }), thCreds)).rejects.toMatchObject({ permanent: true });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("a failed create is retryable unless Threads says the request itself is bad", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(json({ error: { message: "Service temporarily unavailable", code: 2 } }, 500)));
    await expect(threadsAdapter.start(job(), thCreds)).rejects.toMatchObject({ permanent: false });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(json({ error: { message: "Invalid parameter", code: 100 } }, 400)));
    await expect(threadsAdapter.start(job(), thCreds)).rejects.toMatchObject({ permanent: true });
  });

  const polled = { containerId: "c1", processingSince: "2026-11-19T00:00:00.000Z" };

  it("never publishes again when the container is already published", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(json({ status: "PUBLISHED" }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await threadsAdapter.poll!(job({ platformData: polled }), thCreds)).toEqual({ state: "published", externalId: "c1", externalUrl: null, platformData: polled });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("keeps waiting while processing and restarts a dead container from scratch", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(json({ status: "IN_PROGRESS" })));
    expect(await threadsAdapter.poll!(job({ platformData: polled }), thCreds)).toEqual({ state: "processing", platformData: polled, retryAfterMs: 5000 });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(json({ status: "EXPIRED" })));
    await expect(threadsAdapter.poll!(job({ platformData: polled }), thCreds)).rejects.toMatchObject({ retryFromStart: true });
  });

  it("publishes a finished container and keeps processingSince", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(json({ status: "FINISHED" }))
      .mockResolvedValueOnce(json({ id: "m1" }))
      .mockResolvedValueOnce(json({ permalink: "https://threads.net/@me/post/m1" }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await threadsAdapter.poll!(job({ platformData: polled }), thCreds)).toEqual({
      state: "published", externalId: "m1", externalUrl: "https://threads.net/@me/post/m1", platformData: { ...polled, mediaId: "m1" },
    });
    expect(String(fetchMock.mock.calls[1][0])).toContain("th-user/threads_publish?creation_id=c1");
  });

  it("after the publish call, retries only rate limits; anything else needs a human", async () => {
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(json({ status: "FINISHED" }))
      .mockResolvedValueOnce(json({ error: { message: "Application request limit reached", code: 4 } }, 400)));
    await expect(threadsAdapter.poll!(job({ platformData: polled }), thCreds)).rejects.toMatchObject({ permanent: false });

    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(json({ status: "FINISHED" }))
      .mockRejectedValueOnce(new TypeError("fetch failed")));
    await expect(threadsAdapter.poll!(job({ platformData: polled }), thCreds)).rejects.toMatchObject({ permanent: true, message: expect.stringContaining("확인 필요") });
  });

  it("does not fail a published post when the permalink lookup breaks", async () => {
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(json({ status: "FINISHED" }))
      .mockResolvedValueOnce(json({ id: "m1" }))
      .mockRejectedValueOnce(new Error("timeout")));
    expect(await threadsAdapter.poll!(job({ platformData: polled }), thCreds)).toMatchObject({ state: "published", externalId: "m1", externalUrl: null });
  });
});
