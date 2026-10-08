import { describe, expect, it, vi, beforeEach } from "vitest";
import { publishOrResumePost } from "./thread-resume-engine";
import { prisma } from "@/lib/prisma";
import * as threadsApi from "@/lib/threads-api";
import * as threadSplitter from "@/lib/thread-splitter";
import type { Post } from "@prisma/client";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    post: {
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
  },
}));

vi.mock("@/lib/threads-api", () => ({
  publishThreadChainWithCredentials: vi.fn(),
}));

describe("thread-resume-engine", () => {
  const credentials = {
    accessToken: "test-token",
    userId: "test-user-id",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("publishes a brand new multi-part post and checkpoints progress to PUBLISHED", async () => {
    const mockPost = {
      id: "post-1",
      brandId: "brand-1",
      content: "A very long content that splits into 3 parts...",
      imageUrls: "[]",
      firstComment: "First comment text",
      threadRootId: null,
      threadPartsPosted: 0,
      threadTotalParts: 1,
      threadPartIds: "[]",
      sideMission: null,
      status: "PENDING",
      threadsId: null,
      scheduledAt: new Date(),
      createdAt: new Date(),
      publishedAt: null,
      errorLog: null,
      formulaId: null,
      topic: null,
      targetAudience: null,
      situation: null,
      hookType: null,
      ctaType: null,
      qualityScore: null,
      qualityProfile: null,
      qualityPass: null,
      qualityReasons: "[]",
      campaignId: null,
      campaignFormulaId: null,
      careerDecisionType: null,
      linkUrl: null,
      utmContent: null,
      clicks: null,
      conversions: null,
      manualPaidConversions: null,
      views: null,
      likes: null,
      replies: null,
      reposts: null,
      metricsAt: null,
      performanceScore: null,
      performanceTier: null,
      learnedAt: null,
    } as unknown as Post;

    vi.mocked(prisma.post.findUnique).mockResolvedValue(mockPost);

    vi.spyOn(threadSplitter, "splitContentIntoThreadParts").mockReturnValue([
      "1/3 part 1",
      "2/3 part 2",
      "3/3 part 3",
    ]);

    vi.mocked(threadsApi.publishThreadChainWithCredentials).mockImplementation(
      async (_text, _creds, _imgs, _firstComment, options) => {
        // Trigger checkpoints
        await options?.onPartPublished?.({
          partIndex: 0,
          totalParts: 3,
          threadsId: "th-root-1",
          allPartIds: ["th-root-1"],
        });
        await options?.onPartPublished?.({
          partIndex: 1,
          totalParts: 3,
          threadsId: "th-part-2",
          allPartIds: ["th-root-1", "th-part-2"],
        });
        await options?.onPartPublished?.({
          partIndex: 2,
          totalParts: 3,
          threadsId: "th-part-3",
          allPartIds: ["th-root-1", "th-part-2", "th-part-3"],
        });

        return {
          rootThreadsId: "th-root-1",
          partIds: ["th-root-1", "th-part-2", "th-part-3"],
          replyError: null,
        };
      }
    );

    const result = await publishOrResumePost("post-1", credentials);

    expect(result.success).toBe(true);
    expect(result.partsPosted).toBe(3);
    expect(result.totalParts).toBe(3);
    expect(result.partIds).toEqual(["th-root-1", "th-part-2", "th-part-3"]);
    expect(result.isResumed).toBe(false);

    // Verify final update to PUBLISHED
    expect(prisma.post.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "post-1" },
        data: expect.objectContaining({
          status: "PUBLISHED",
          threadsId: "th-root-1",
          threadPartsPosted: 3,
          threadTotalParts: 3,
        }),
      })
    );
  });

  it("handles partial failure, preserves root id and marks PARTIAL_FAILED", async () => {
    const mockPost = {
      id: "post-fail",
      brandId: "brand-1",
      content: "Content that fails on part 2",
      imageUrls: "[]",
      firstComment: null,
      threadRootId: null,
      threadPartsPosted: 0,
      threadTotalParts: 1,
      threadPartIds: "[]",
      sideMission: null,
      status: "PENDING",
      threadsId: null,
      scheduledAt: new Date(),
      createdAt: new Date(),
      publishedAt: null,
      errorLog: null,
      formulaId: null,
      topic: null,
      targetAudience: null,
      situation: null,
      hookType: null,
      ctaType: null,
      qualityScore: null,
      qualityProfile: null,
      qualityPass: null,
      qualityReasons: "[]",
      campaignId: null,
      campaignFormulaId: null,
      careerDecisionType: null,
      linkUrl: null,
      utmContent: null,
      clicks: null,
      conversions: null,
      manualPaidConversions: null,
      views: null,
      likes: null,
      replies: null,
      reposts: null,
      metricsAt: null,
      performanceScore: null,
      performanceTier: null,
      learnedAt: null,
    } as unknown as Post;

    vi.mocked(prisma.post.findUnique).mockResolvedValue(mockPost);

    vi.spyOn(threadSplitter, "splitContentIntoThreadParts").mockReturnValue([
      "1/2 part 1",
      "2/2 part 2",
    ]);

    vi.mocked(threadsApi.publishThreadChainWithCredentials).mockImplementation(
      async (_text, _creds, _imgs, _firstComment, options) => {
        // Part 1 succeeds
        await options?.onPartPublished?.({
          partIndex: 0,
          totalParts: 2,
          threadsId: "th-root-fail",
          allPartIds: ["th-root-fail"],
        });

        // Part 2 fails and returns partial result
        return {
          rootThreadsId: "th-root-fail",
          partIds: ["th-root-fail"],
          replyError: "Part 2 failed: Network timeout",
        };
      }
    );

    const result = await publishOrResumePost("post-fail", credentials);

    expect(result.success).toBe(false);
    expect(result.partsPosted).toBe(1);
    expect(result.totalParts).toBe(2);
    expect(result.rootThreadsId).toBe("th-root-fail");

    // Check DB was updated with PARTIAL_FAILED and saved root info
    expect(prisma.post.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "post-fail" },
        data: expect.objectContaining({
          status: "PARTIAL_FAILED",
          threadRootId: "th-root-fail",
          threadPartsPosted: 1,
        }),
      })
    );
  });

  it("resumes an incomplete thread from part 2 without re-publishing root part 1", async () => {
    const mockPartialPost = {
      id: "post-resume",
      brandId: "brand-1",
      content: "Content resuming from part 2",
      imageUrls: "[]",
      firstComment: null,
      threadRootId: "th-root-existing",
      threadPartsPosted: 1,
      threadTotalParts: 2,
      threadPartIds: JSON.stringify(["th-root-existing"]),
      sideMission: null,
      status: "PARTIAL_FAILED",
      threadsId: "th-root-existing",
      scheduledAt: new Date(),
      createdAt: new Date(),
      publishedAt: null,
      errorLog: null,
      formulaId: null,
      topic: null,
      targetAudience: null,
      situation: null,
      hookType: null,
      ctaType: null,
      qualityScore: null,
      qualityProfile: null,
      qualityPass: null,
      qualityReasons: "[]",
      campaignId: null,
      campaignFormulaId: null,
      careerDecisionType: null,
      linkUrl: null,
      utmContent: null,
      clicks: null,
      conversions: null,
      manualPaidConversions: null,
      views: null,
      likes: null,
      replies: null,
      reposts: null,
      metricsAt: null,
      performanceScore: null,
      performanceTier: null,
      learnedAt: null,
    } as unknown as Post;

    vi.mocked(prisma.post.findUnique).mockResolvedValue(mockPartialPost);

    vi.spyOn(threadSplitter, "splitContentIntoThreadParts").mockReturnValue([
      "1/2 part 1",
      "2/2 part 2",
    ]);

    vi.mocked(threadsApi.publishThreadChainWithCredentials).mockImplementation(
      async (_text, _creds, _imgs, _firstComment, options) => {
        expect(options?.existingRootThreadsId).toBe("th-root-existing");
        expect(options?.startFromPartIndex).toBe(1);

        // Resume publishes part 2
        await options?.onPartPublished?.({
          partIndex: 1,
          totalParts: 2,
          threadsId: "th-part-2-resumed",
          allPartIds: ["th-root-existing", "th-part-2-resumed"],
        });

        return {
          rootThreadsId: "th-root-existing",
          partIds: ["th-root-existing", "th-part-2-resumed"],
          replyError: null,
        };
      }
    );

    const result = await publishOrResumePost("post-resume", credentials);

    expect(result.success).toBe(true);
    expect(result.isResumed).toBe(true);
    expect(result.partsPosted).toBe(2);
    expect(result.partIds).toEqual(["th-root-existing", "th-part-2-resumed"]);

    expect(prisma.post.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "post-resume" },
        data: expect.objectContaining({
          status: "PUBLISHED",
          threadPartsPosted: 2,
        }),
      })
    );
  });

  it("throws error and aborts when post is locked by another concurrent worker", async () => {
    const mockPost = {
      id: "post-concurrent",
      status: "PUBLISHING",
      content: "Short post",
      imageUrls: "[]",
      firstComment: null,
      threadRootId: null,
      threadPartsPosted: 0,
      threadTotalParts: 1,
      threadPartIds: "[]",
    } as unknown as Post;

    vi.mocked(prisma.post.findUnique).mockResolvedValue(mockPost);
    // Lock failed because already PUBLISHING
    vi.mocked(prisma.post.updateMany).mockResolvedValue({ count: 0 });

    await expect(publishOrResumePost("post-concurrent", credentials)).rejects.toThrow(
      /is already being published/
    );
  });
  it("tags brand links with pid on first publish but not when resuming", async () => {
    const basePost = {
      id: "post-link",
      content: "확인 https://www.cosmicpath.app/start?entry=x",
      firstComment: "링크 https://www.cosmicpath.app/start",
      imageUrls: "[]",
      threadPartIds: "[]",
      threadPartsPosted: 0,
      threadRootId: null,
      status: "PENDING",
      brand: { brandConfig: JSON.stringify({ websiteUrl: "https://www.cosmicpath.app/start" }) },
    };
    vi.mocked(prisma.post.updateMany).mockResolvedValue({ count: 1 });
    vi.mocked(prisma.post.findUnique).mockResolvedValue(basePost as unknown as Post);
    vi.spyOn(threadSplitter, "splitContentIntoThreadParts").mockImplementation((text: string) => [text]);
    vi.mocked(threadsApi.publishThreadChainWithCredentials).mockResolvedValue({
      rootThreadsId: "th-1",
      partIds: ["th-1"],
      replyError: null,
    });

    await publishOrResumePost("post-link", credentials);

    const [text, , , firstComment] = vi.mocked(threadsApi.publishThreadChainWithCredentials).mock.calls[0];
    expect(text).toBe("확인 https://www.cosmicpath.app/start?entry=x&pid=post-link");
    expect(firstComment).toBe("링크 https://www.cosmicpath.app/start?pid=post-link");
    expect(prisma.post.update).toHaveBeenCalledWith({
      where: { id: "post-link" },
      data: { content: text, firstComment },
    });

    vi.clearAllMocks();
    vi.mocked(prisma.post.updateMany).mockResolvedValue({ count: 1 });
    vi.mocked(prisma.post.findUnique).mockResolvedValue({
      ...basePost,
      threadRootId: "th-1",
      threadPartsPosted: 1,
      status: "PARTIAL_FAILED",
    } as unknown as Post);
    vi.spyOn(threadSplitter, "splitContentIntoThreadParts").mockReturnValue(["a", "b"]);
    vi.mocked(threadsApi.publishThreadChainWithCredentials).mockResolvedValue({
      rootThreadsId: "th-1",
      partIds: ["th-1", "th-2"],
      replyError: null,
    });

    await publishOrResumePost("post-link", credentials);

    expect(vi.mocked(threadsApi.publishThreadChainWithCredentials).mock.calls[0][0]).toBe(basePost.content);
  });
});
