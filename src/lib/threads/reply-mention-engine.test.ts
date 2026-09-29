import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  fetchPostRepliesWithCap,
  fetchMentionsSafely,
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
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("@/lib/threads-api", () => ({
  publishReplyWithRetryForBrand: vi.fn(),
}));

vi.mock("@anthropic-ai/sdk", () => {
  return {
    default: class MockAnthropic {
      messages = {
        create: vi.fn(async () => ({
          content: [{ text: "반가워요! 댓글 감사합니다 :)" }],
        })),
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
  });

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
});
