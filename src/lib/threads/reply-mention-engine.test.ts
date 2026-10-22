import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  fetchPostRepliesWithCap,
  fetchMentionsSafely,
  fetchOwnUsername,
  isReaderReplyEligible,
  publishDueDraftReplies,
  scanAndDraftRepliesForBrand,
  publishApprovedReply,
} from "./reply-mention-engine";
import { prisma } from "@/lib/prisma";
import * as threadsApi from "@/lib/threads-api";
import type { Post, ThreadReply } from "@prisma/client";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    post: {
      findMany: vi.fn(),
    },
    threadReply: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("@/lib/threads-api", () => ({
  publishReplyWithRetryForBrand: vi.fn(),
}));

const llm = vi.hoisted(() => ({ fails: false }));
vi.mock("@anthropic-ai/sdk", () => {
  return {
    default: class MockAnthropic {
      messages = {
        create: vi.fn(async () => {
          if (llm.fails) throw new Error("overloaded");
          return { content: [{ type: "text", text: "반가워요! 댓글 감사합니다 :)" }] };
        }),
      };
    },
  };
});

describe("reply-mention-engine", () => {
  const credentials = {
    accessToken: "test-token",
    userId: "test-user-id",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    llm.fails = false;
    vi.mocked(prisma.threadReply.count).mockResolvedValue(0);
  });

  const meOk = { ok: true, json: async () => ({ username: "cosmicpath.kr" }) };

  describe("fetchPostRepliesWithCap", () => {
    it("strictly truncates replies to maxCap (20-Cap) when post has excess comments", async () => {
      const mockComments = Array.from({ length: 30 }, (_, i) => ({
        id: `reply-${i + 1}`,
        text: `Comment number ${i + 1}`,
        username: `user_${i + 1}`,
      }));

      const mockFetch = vi.fn(async () => ({
        ok: true,
        json: async () => ({ data: mockComments }),
      })) as unknown as typeof fetch;

      const result = await fetchPostRepliesWithCap("th-post-1", credentials, 20, mockFetch);

      expect(result.replies.length).toBe(20);
      expect(result.totalAvailable).toBe(30);
      expect(result.wasTruncated).toBe(true);
      expect(result.replies[0].id).toBe("reply-1");
      expect(result.replies[19].id).toBe("reply-20");
    });

    it("does not truncate when reply count is within cap", async () => {
      const mockComments = [
        { id: "reply-1", text: "Nice post!", username: "user_1" },
        { id: "reply-2", text: "Agreed", username: "user_2" },
      ];

      const mockFetch = vi.fn(async () => ({
        ok: true,
        json: async () => ({ data: mockComments }),
      })) as unknown as typeof fetch;

      const result = await fetchPostRepliesWithCap("th-post-1", credentials, 20, mockFetch);

      expect(result.replies.length).toBe(2);
      expect(result.totalAvailable).toBe(2);
      expect(result.wasTruncated).toBe(false);
    });
  });

  describe("fetchMentionsSafely", () => {
    it("gracefully catches 403 or permission denial without throwing", async () => {
      const mockFetch = vi.fn(async () => ({
        ok: false,
        status: 403,
        text: async () => "Application does not have permission",
      })) as unknown as typeof fetch;

      const result = await fetchMentionsSafely(credentials, mockFetch);

      expect(result.accessible).toBe(false);
      expect(result.mentions).toEqual([]);
      expect(result.error).toContain("Mentions access denied");
    });

    it("parses mentions when accessible", async () => {
      const mockFetch = vi.fn(async () => ({
        ok: true,
        json: async () => ({
          data: [{ id: "mention-1", text: "Hey @test check this", username: "fan" }],
        }),
      })) as unknown as typeof fetch;

      const result = await fetchMentionsSafely(credentials, mockFetch);

      expect(result.accessible).toBe(true);
      expect(result.mentions.length).toBe(1);
      expect(result.mentions[0].isMention).toBe(true);
    });
  });

  describe("scanAndDraftRepliesForBrand", () => {
    it("scans posts, creates DRAFT records, and logs truncated threads", async () => {
      vi.mocked(prisma.post.findMany).mockResolvedValue([
        {
          id: "post_1",
          threadsId: "th_post_1",
          content: "Original post content",
          publishedAt: new Date(),
        } as unknown as Post,
      ]);

      vi.mocked(prisma.threadReply.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.threadReply.create).mockResolvedValue({ id: "draft_1" } as unknown as ThreadReply);

      const mockComments = Array.from({ length: 25 }, (_, i) => ({
        id: `reply-${i + 1}`,
        text: `Comment ${i + 1}`,
        username: `user_${i + 1}`,
      }));

      const mockFetch = vi.fn(async (url: string | URL | Request) => {
        const urlStr = url.toString();
        if (urlStr.includes("/me?")) return meOk;
        if (urlStr.includes("/replies")) {
          return {
            ok: true,
            json: async () => ({ data: mockComments }),
          };
        }
        return {
          ok: false,
          status: 403,
          text: async () => "No permission",
        };
      }) as unknown as typeof fetch;

      const result = await scanAndDraftRepliesForBrand("brand_1", credentials, {
        maxCapPerPost: 20,
        maxDraftsPerRun: 20,
        fetchFn: mockFetch,
      });

      expect(result.scannedPosts).toBe(1);
      expect(result.totalRepliesFound).toBe(25);
      expect(result.draftsCreated).toBe(20);
      expect(result.truncatedThreads).toEqual([
        { postThreadsId: "th_post_1", totalReplies: 25, kept: 20 },
      ]);
      expect(result.mentionsAccessible).toBe(false);
      expect(prisma.threadReply.create).toHaveBeenCalledTimes(20);
      expect(prisma.threadReply.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: "DRAFT",
            brandId: "brand_1",
          }),
        })
      );
    });
  });

  describe("publishApprovedReply", () => {
    it("calls publishReplyWithRetryForBrand and transitions status to PUBLISHED", async () => {
      vi.mocked(prisma.threadReply.findUnique).mockResolvedValue({
        id: "reply_record_1",
        replyThreadsId: "th_comment_1",
        replyText: "Approved reply content",
      } as unknown as ThreadReply);

      vi.mocked(threadsApi.publishReplyWithRetryForBrand).mockResolvedValue("new_th_reply_id");
      vi.mocked(prisma.threadReply.update).mockResolvedValue({} as unknown as ThreadReply);

      const result = await publishApprovedReply("reply_record_1", credentials);

      expect(result.success).toBe(true);
      expect(result.publishedThreadsId).toBe("new_th_reply_id");
      expect(threadsApi.publishReplyWithRetryForBrand).toHaveBeenCalledWith(
        "Approved reply content",
        "th_comment_1",
        credentials
      );
      expect(prisma.threadReply.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "reply_record_1" },
          data: { status: "PUBLISHED" },
        })
      );
    });
  });
  describe("isReaderReplyEligible", () => {
    const reply = (text: string, username = "reader") => ({ id: "r", text, username });

    it("drops the brand's own first comment, link spam, follow-back bait, and empty replies", () => {
      expect(isReaderReplyEligible(reply("너는 몇 번 골랐냐?", "cosmicpath.kr"), "cosmicpath.kr")).toBe(false);
      expect(isReaderReplyEligible(reply("너는 몇 번 골랐냐?", "@CosmicPath.kr"), "cosmicpath.kr")).toBe(false);
      expect(isReaderReplyEligible(reply("무료 사주 https://spam.example"))).toBe(false);
      expect(isReaderReplyEligible(reply("맞팔해요~"))).toBe(false);
      expect(isReaderReplyEligible(reply("follow back pls"))).toBe(false);
      expect(isReaderReplyEligible(reply("ㅋ"))).toBe(false);
    });

    it("keeps an ordinary reader comment", () => {
      expect(isReaderReplyEligible(reply("나 2번인데 진짜 1년 존버함"), "cosmicpath.kr")).toBe(true);
    });
  });

  describe("fetchOwnUsername", () => {
    it("returns the handle from /me and null on failure", async () => {
      const okFetch = vi.fn(async () => ({ ok: true, json: async () => ({ username: "cosmicpath.kr" }) })) as unknown as typeof fetch;
      const badFetch = vi.fn(async () => ({ ok: false, status: 401 })) as unknown as typeof fetch;
      expect(await fetchOwnUsername(credentials, okFetch)).toBe("cosmicpath.kr");
      expect(await fetchOwnUsername(credentials, badFetch)).toBeNull();
    });
  });

  describe("scanAndDraftRepliesForBrand self filter", () => {
    it("never drafts a reply to the brand's own first comment", async () => {
      vi.mocked(prisma.post.findMany).mockResolvedValue([
        { id: "post_1", threadsId: "th_post_1", content: "원문", publishedAt: new Date() } as unknown as Post,
      ]);
      vi.mocked(prisma.threadReply.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.threadReply.create).mockResolvedValue({ id: "draft_1" } as unknown as ThreadReply);
      const mockFetch = vi.fn(async (url: string | URL | Request) => {
        const urlStr = url.toString();
        if (urlStr.includes("/me?")) return { ok: true, json: async () => ({ username: "cosmicpath.kr" }) };
        if (urlStr.includes("/replies")) {
          return {
            ok: true,
            json: async () => ({
              data: [
                { id: "own", text: "난 2번 고르고 존버했음. 너넨?", username: "cosmicpath.kr" },
                { id: "reader", text: "나도 2번 ㅠ", username: "reader_1" },
              ],
            }),
          };
        }
        return { ok: false, status: 403, text: async () => "" };
      }) as unknown as typeof fetch;

      const result = await scanAndDraftRepliesForBrand("brand_1", credentials, { fetchFn: mockFetch });

      expect(result.draftsCreated).toBe(1);
      expect(prisma.threadReply.create).toHaveBeenCalledTimes(1);
      expect(prisma.threadReply.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ replyThreadsId: "reader" }) })
      );
    });
  });

  describe("publishDueDraftReplies", () => {
    it("publishes only fresh reader drafts, capped per run, and marks a failed publish", async () => {
      const now = new Date("2026-10-22T12:00:00Z");
      const drafts = [
        { id: "d1", replyThreadsId: "c1", replyText: "답1", createdAt: new Date("2026-10-22T10:00:00Z") },
        { id: "d2", replyThreadsId: "c2", replyText: "답2", createdAt: new Date("2026-10-22T11:00:00Z") },
      ] as unknown as ThreadReply[];
      vi.mocked(prisma.threadReply.findMany).mockResolvedValue(drafts);
      vi.mocked(prisma.threadReply.findUnique).mockImplementation((async (args: { where: { id?: string } }) =>
        drafts.find((draft) => draft.id === args.where.id) ?? null) as unknown as typeof prisma.threadReply.findUnique);
      vi.mocked(prisma.threadReply.update).mockResolvedValue({} as unknown as ThreadReply);
      vi.mocked(threadsApi.publishReplyWithRetryForBrand)
        .mockResolvedValueOnce("pub_1")
        .mockRejectedValueOnce(new Error("rate limited"));

      const result = await publishDueDraftReplies("brand_1", credentials, { now });

      expect(prisma.threadReply.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            brandId: "brand_1",
            status: "DRAFT",
            isMention: false,
            createdAt: { gte: new Date("2026-10-20T12:00:00Z") },
          }),
          take: 3,
        })
      );
      expect(result).toEqual({ brandId: "brand_1", published: 1, failed: 1, stuck: 0, errors: ["d2: rate limited"] });
      expect(prisma.threadReply.update).toHaveBeenCalledWith({ where: { id: "d1" }, data: { status: "PUBLISHED" } });
      expect(prisma.threadReply.update).toHaveBeenCalledWith({ where: { id: "d2" }, data: { status: "FAILED" } });
    });
  });

  // PR #20 review: the three ways the auto-publish path could create spam signals.
  describe("auto-reply safety (PR #20)", () => {
    const readerReplies = [{ id: "reader", text: "나도 2번 ㅠ", username: "reader_1" }];
    const fetchWith = (me: unknown) => vi.fn(async (url: string | URL | Request) => {
      const urlStr = url.toString();
      if (urlStr.includes("/me?")) return me;
      if (urlStr.includes("/replies")) return { ok: true, json: async () => ({ data: readerReplies }) };
      return { ok: false, status: 403, text: async () => "" };
    }) as unknown as typeof fetch;

    it("skips post replies for the run when /me fails instead of treating own comments as readers'", async () => {
      vi.mocked(prisma.post.findMany).mockResolvedValue([
        { id: "post_1", threadsId: "th_post_1", content: "원문", publishedAt: new Date() } as unknown as Post,
      ]);
      const result = await scanAndDraftRepliesForBrand("brand_1", credentials, { fetchFn: fetchWith({ ok: false, status: 401 }) });

      expect(result.scannedPosts).toBe(0);
      expect(result.draftsCreated).toBe(0);
      expect(prisma.threadReply.create).not.toHaveBeenCalled();
      expect(result.errors.join(" ")).toContain("Own username unavailable");
    });

    it("creates no row when the LLM fails, so nothing canned can be auto-posted and the comment retries next run", async () => {
      llm.fails = true;
      vi.mocked(prisma.post.findMany).mockResolvedValue([
        { id: "post_1", threadsId: "th_post_1", content: "원문", publishedAt: new Date() } as unknown as Post,
      ]);
      vi.mocked(prisma.threadReply.findUnique).mockResolvedValue(null);
      const result = await scanAndDraftRepliesForBrand("brand_1", credentials, { fetchFn: fetchWith(meOk) });

      expect(result.draftsCreated).toBe(0);
      expect(result.draftsSkipped).toBe(1);
      expect(prisma.threadReply.create).not.toHaveBeenCalled();
    });

    it("caps new drafts per run so a comment burst cannot eat the route budget", async () => {
      vi.mocked(prisma.post.findMany).mockResolvedValue([
        { id: "post_1", threadsId: "th_post_1", content: "원문", publishedAt: new Date() } as unknown as Post,
      ]);
      vi.mocked(prisma.threadReply.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.threadReply.create).mockResolvedValue({ id: "d" } as unknown as ThreadReply);
      const burst = Array.from({ length: 9 }, (_, index) => ({ id: `r${index}`, text: `댓글 ${index} 진짜 공감`, username: `u${index}` }));
      const mockFetch = vi.fn(async (url: string | URL | Request) => {
        const urlStr = url.toString();
        if (urlStr.includes("/me?")) return meOk;
        if (urlStr.includes("/replies")) return { ok: true, json: async () => ({ data: burst }) };
        return { ok: false, status: 403, text: async () => "" };
      }) as unknown as typeof fetch;

      const result = await scanAndDraftRepliesForBrand("brand_1", credentials, { fetchFn: mockFetch });
      expect(result.draftsCreated).toBe(5);
      expect(prisma.threadReply.create).toHaveBeenCalledTimes(5);
    });

    it("claims the row as PUBLISHING before calling Threads, so an interrupted run cannot double-post", async () => {
      vi.mocked(prisma.threadReply.findUnique).mockResolvedValue({
        id: "d1", replyThreadsId: "c1", replyText: "답1",
      } as unknown as ThreadReply);
      vi.mocked(prisma.threadReply.update).mockResolvedValue({} as unknown as ThreadReply);
      vi.mocked(threadsApi.publishReplyWithRetryForBrand).mockResolvedValue("pub_1");

      await publishApprovedReply("d1", credentials);

      const update = vi.mocked(prisma.threadReply.update);
      const publish = vi.mocked(threadsApi.publishReplyWithRetryForBrand);
      expect(update.mock.calls[0][0]).toEqual({ where: { id: "d1" }, data: { status: "PUBLISHING" } });
      expect(update.mock.invocationCallOrder[0]).toBeLessThan(publish.mock.invocationCallOrder[0]);
      expect(update.mock.calls[1][0]).toEqual({ where: { id: "d1" }, data: { status: "PUBLISHED" } });
    });

    it("reports rows stuck in PUBLISHING instead of retrying them", async () => {
      vi.mocked(prisma.threadReply.findMany).mockResolvedValue([]);
      vi.mocked(prisma.threadReply.count).mockResolvedValue(2);
      const result = await publishDueDraftReplies("brand_1", credentials);
      expect(result.stuck).toBe(2);
      expect(prisma.threadReply.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ status: "DRAFT" }) }));
    });
  });
});
