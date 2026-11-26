import { afterEach, describe, expect, it, vi } from "vitest";
import { normalizeChatInput, TelegramConnectError, verifyTelegramChannel } from "./telegram-connect";

const ok = (result: unknown) => new Response(JSON.stringify({ ok: true, result }), { status: 200 });

afterEach(() => vi.unstubAllGlobals());

describe("normalizeChatInput", () => {
  it.each([
    ["@ai_news_kr", "@ai_news_kr"],
    ["ai_news_kr", "@ai_news_kr"],
    ["https://t.me/ai_news_kr", "@ai_news_kr"],
    ["https://t.me/ai_news_kr/123", "@ai_news_kr"],
    ["-1001234567890", "-1001234567890"],
    ["ab", null],
    ["https://evil.example/x", null],
  ])("%s → %s", (input, expected) => expect(normalizeChatInput(input)).toBe(expected));
});

describe("verifyTelegramChannel", () => {
  it("accepts a channel where the bot may post", async () => {
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(ok({ id: 42 }))
      .mockResolvedValueOnce(ok({ id: -1001, type: "channel", title: "AI 뉴스", username: "ai_news_kr" }))
      .mockResolvedValueOnce(ok({ status: "administrator", can_post_messages: true })));
    // Stored by numeric id: a renamed @handle (or a new channel taking the old name) must not change who it is.
    expect(await verifyTelegramChannel("t.me/ai_news_kr", "TOKEN")).toEqual({ chatId: "-1001", handle: "@ai_news_kr" });
  });

  it("keeps a private channel by numeric id, without a public handle", async () => {
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(ok({ id: 42 }))
      .mockResolvedValueOnce(ok({ id: -1001234567890, type: "channel", title: "비공개 채널" }))
      .mockResolvedValueOnce(ok({ status: "creator" })));
    expect(await verifyTelegramChannel("-1001234567890", "TOKEN")).toEqual({ chatId: "-1001234567890", handle: "비공개 채널" });
  });

  it("rejects groups and bots without the post permission, never echoing the token", async () => {
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(ok({ id: 42 }))
      .mockResolvedValueOnce(ok({ id: -1, type: "supergroup", title: "g" })));
    await expect(verifyTelegramChannel("@some_group", "TOKEN")).rejects.toThrow(/채널만/);

    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(ok({ id: 42 }))
      .mockResolvedValueOnce(ok({ id: -1, type: "channel", title: "c", username: "chan_x" }))
      .mockResolvedValueOnce(ok({ status: "administrator", can_post_messages: false })));
    await expect(verifyTelegramChannel("@chan_x", "TOKEN")).rejects.toThrow(/게시/);

    vi.stubGlobal("fetch", vi.fn().mockRejectedValueOnce(new TypeError("fetch failed https://api.telegram.org/botTOKEN/getMe")));
    const error = await verifyTelegramChannel("@chan_x", "TOKEN").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(TelegramConnectError);
    expect((error as Error).message).not.toContain("TOKEN");
  });
});
