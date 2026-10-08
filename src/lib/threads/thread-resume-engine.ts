import { prisma } from "@/lib/prisma";
import {
  publishThreadChainWithCredentials,
  type ThreadsCredentials,
} from "@/lib/threads-api";
import { splitContentIntoThreadParts } from "@/lib/thread-splitter";
import { tagBrandLinks } from "@/lib/tracking-url";
import { parseBrandConfig } from "@/types/brand";

export interface ResumePublishResult {
  success: boolean;
  postId: string;
  rootThreadsId: string | null;
  partsPosted: number;
  totalParts: number;
  partIds: string[];
  isResumed: boolean;
  error?: string | null;
}

/**
 * Resumable Multi-Part Thread Publisher
 *
 * Inspired by autoTHREADS multi-part (1/n) progress persistence.
 * Checkpoints every published part in the database. If a network blip or rate limit
 * interrupts part 2..N, the next execution cleanly resumes from the failed index
 * without duplicating root posts.
 */
export async function publishOrResumePost(
  postId: string,
  credentials: ThreadsCredentials,
  options?: { delayBetweenPartsMs?: number }
): Promise<ResumePublishResult> {
  const post = await prisma.post.findUnique({
    where: { id: postId },
    include: { brand: { select: { brandConfig: true } } },
  });

  if (!post) {
    throw new Error(`Post ${postId} not found`);
  }

  // Tag brand links with pid on first publish only; a resumed thread must keep the
  // exact content its earlier parts were split from.
  const brandConfig = parseBrandConfig(post.brand?.brandConfig ?? "{}");
  const brandUrls = [brandConfig.websiteUrl, brandConfig.productProfile?.landingUrl ?? ""];
  const tag = (text: string) => (post.threadRootId ? text : tagBrandLinks(text, post.id, brandUrls));
  const content = tag(post.content);
  const firstComment = post.firstComment ? tag(post.firstComment) : post.firstComment;

  let imageUrls: string[] = [];
  try {
    imageUrls = JSON.parse(post.imageUrls || "[]");
  } catch {
    imageUrls = [];
  }

  let existingPartIds: string[] = [];
  try {
    existingPartIds = JSON.parse(post.threadPartIds || "[]");
  } catch {
    existingPartIds = [];
  }

  const parts = splitContentIntoThreadParts(content);
  const totalParts = parts.length;
  const startFromPartIndex = post.threadPartsPosted || 0;
  const isResumed = Boolean(post.threadRootId && startFromPartIndex > 0 && startFromPartIndex < totalParts);

  // If already fully published, avoid re-publishing
  if (post.status === "PUBLISHED" && post.threadsId && post.threadPartsPosted === totalParts) {
    return {
      success: true,
      postId: post.id,
      rootThreadsId: post.threadsId,
      partsPosted: totalParts,
      totalParts,
      partIds: existingPartIds.length > 0 ? existingPartIds : [post.threadsId],
      isResumed: false,
    };
  }

  // Atomic Lock: Mark post as PUBLISHING to prevent concurrent duplicate publishing
  const lockAcquired = await prisma.post.updateMany({
    where: {
      id: postId,
      // Block only in-flight/finished/archived posts; a manual publish of NEEDS_REVIEW or FAILED is a human approval.
      status: { notIn: ["PUBLISHING", "PARTIAL_PUBLISHED", "PROCESSING", "PUBLISHED", "ARCHIVED"] },
    },
    data: {
      status: "PUBLISHING",
    },
  });

  if (lockAcquired.count === 0) {
    const current = await prisma.post.findUnique({ where: { id: postId } });
    if (current?.status === "PUBLISHED" && current.threadsId) {
      return {
        success: true,
        postId: current.id,
        rootThreadsId: current.threadsId,
        partsPosted: current.threadPartsPosted || totalParts,
        totalParts,
        partIds: JSON.parse(current.threadPartIds || "[]"),
        isResumed: false,
      };
    }
    throw new Error(`Post ${postId} is already being published or locked by another worker (status: ${current?.status})`);
  }

  try {
    if (content !== post.content || firstComment !== post.firstComment) {
      await prisma.post.update({ where: { id: postId }, data: { content, firstComment } });
    }

    const result = await publishThreadChainWithCredentials(
      content,
      credentials,
      imageUrls,
      firstComment,
      {
        delayBetweenPartsMs: options?.delayBetweenPartsMs,
        existingRootThreadsId: post.threadRootId || undefined,
        existingPartIds: existingPartIds.length > 0 ? existingPartIds : undefined,
        startFromPartIndex,
        onPartPublished: async (checkpoint) => {
          await prisma.post.update({
            where: { id: postId },
            data: {
              threadRootId: checkpoint.allPartIds[0],
              threadPartsPosted: checkpoint.allPartIds.length,
              threadTotalParts: totalParts,
              threadPartIds: JSON.stringify(checkpoint.allPartIds),
              status: checkpoint.allPartIds.length === totalParts ? "PUBLISHED" : "PARTIAL_PUBLISHED",
            },
          });
        },
      }
    );

    const isComplete = result.partIds.length === totalParts;

    if (isComplete) {
      await prisma.post.update({
        where: { id: postId },
        data: {
          status: "PUBLISHED",
          threadsId: result.rootThreadsId,
          publishedAt: new Date(),
          threadRootId: result.rootThreadsId,
          threadPartsPosted: totalParts,
          threadTotalParts: totalParts,
          threadPartIds: JSON.stringify(result.partIds),
          errorLog: result.replyError ? `Warning: ${result.replyError}` : null,
        },
      });

      return {
        success: true,
        postId: post.id,
        rootThreadsId: result.rootThreadsId,
        partsPosted: totalParts,
        totalParts,
        partIds: result.partIds,
        isResumed,
        error: result.replyError,
      };
    } else {
      // Partial failure during parts 2..N
      const errorMsg = result.replyError || `Stopped at part ${result.partIds.length}/${totalParts}`;
      await prisma.post.update({
        where: { id: postId },
        data: {
          status: "PARTIAL_FAILED",
          threadsId: result.rootThreadsId,
          threadRootId: result.rootThreadsId,
          threadPartsPosted: result.partIds.length,
          threadTotalParts: totalParts,
          threadPartIds: JSON.stringify(result.partIds),
          errorLog: errorMsg,
        },
      });

      return {
        success: false,
        postId: post.id,
        rootThreadsId: result.rootThreadsId,
        partsPosted: result.partIds.length,
        totalParts,
        partIds: result.partIds,
        isResumed,
        error: errorMsg,
      };
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Publishing error";
    const currentStatus = post.threadRootId ? "PARTIAL_FAILED" : "FAILED";

    await prisma.post.update({
      where: { id: postId },
      data: {
        status: currentStatus,
        errorLog: errorMsg,
      },
    });

    return {
      success: false,
      postId: post.id,
      rootThreadsId: post.threadRootId,
      partsPosted: post.threadPartsPosted || 0,
      totalParts,
      partIds: existingPartIds,
      isResumed,
      error: errorMsg,
    };
  }
}
