import { prisma } from "@/lib/prisma";
import { type ThreadsCredentials, publishReplyWithRetryForBrand } from "@/lib/threads-api";
import Anthropic from "@anthropic-ai/sdk";

export const THREADS_MAX_UNANSWERED_REPLIES_PER_POST = 20;

export interface RawThreadsReply {
  id: string;
  text: string;
  username: string;
  timestamp?: string;
  isMention?: boolean;
}

export interface ScanRepliesResult {
  brandId: string;
  scannedPosts: number;
  totalRepliesFound: number;
  draftsCreated: number;
  truncatedThreads: Array<{ postThreadsId: string; totalReplies: number; kept: number }>;
  mentionsAccessible: boolean;
  errors: string[];
}

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  timeout: 15000,
});

/**
 * Fetches replies for a given post from Meta Threads Graph API,
 * strictly enforcing the 20-Cap safety ceiling on unanswered replies.
 */
export async function fetchPostRepliesWithCap(
  postThreadsId: string,
  credentials: ThreadsCredentials,
  maxCap = THREADS_MAX_UNANSWERED_REPLIES_PER_POST,
  fetchFn = fetch
): Promise<{ replies: RawThreadsReply[]; totalAvailable: number; wasTruncated: boolean }> {
  const url = `https://graph.threads.net/v1.0/${postThreadsId}/replies?fields=id,text,timestamp,username,reply_to_id&limit=50&access_token=${credentials.accessToken}`;

  const response = await fetchFn(url);
  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    throw new Error(`Threads API replies fetch failed (${response.status}): ${errText}`);
  }

  const data = await response.json();
  const rawList: Array<{ id: string; text?: string; username?: string; timestamp?: string }> = data.data || [];

  // Filter valid comments (exclude self-replies if needed)
  const validReplies: RawThreadsReply[] = rawList
    .filter((item) => item.id && item.text)
    .map((item) => ({
      id: item.id,
      text: item.text ?? "",
      username: item.username ?? "anonymous",
      timestamp: item.timestamp,
      isMention: false,
    }));

  const totalAvailable = validReplies.length;
  const wasTruncated = totalAvailable > maxCap;
  // Sort descending by timestamp or keep newest maxCap
  const cappedReplies = validReplies.slice(0, maxCap);

  return {
    replies: cappedReplies,
    totalAvailable,
    wasTruncated,
  };
}

/**
 * Attempts to fetch @mentions with graceful fallback if Meta Advanced Access is missing.
 */
export async function fetchMentionsSafely(
  credentials: ThreadsCredentials,
  fetchFn = fetch
): Promise<{ mentions: RawThreadsReply[]; accessible: boolean; error?: string }> {
  const url = `https://graph.threads.net/v1.0/${credentials.userId}/mentions?fields=id,text,timestamp,username&limit=20&access_token=${credentials.accessToken}`;

  try {
    const response = await fetchFn(url);
    if (!response.ok) {
      return {
        mentions: [],
        accessible: false,
        error: `Mentions access denied or unapproved (${response.status})`,
      };
    }

    const data = await response.json();
    const rawList: Array<{ id: string; text?: string; username?: string; timestamp?: string }> = data.data || [];
    const mentions: RawThreadsReply[] = rawList
      .filter((item) => item.id && item.text)
      .map((item) => ({
        id: item.id,
        text: item.text ?? "",
        username: item.username ?? "anonymous",
        timestamp: item.timestamp,
        isMention: true,
      }));

    return {
      mentions,
      accessible: true,
    };
  } catch (err) {
    return {
      mentions: [],
      accessible: false,
      error: err instanceof Error ? err.message : "Unknown error fetching mentions",
    };
  }
}

/**
 * Generates an empathetic, human-like, non-robotic reply using Anthropic LLM.
 */
export async function generateDraftReplyContent(
  authorUsername: string,
  commentText: string,
  postContext: string,
  options?: { creatorHandle?: string; brandTone?: string }
): Promise<string> {
  const isCreator = options?.creatorHandle && authorUsername.replace("@", "").toLowerCase() === options.creatorHandle.replace("@", "").toLowerCase();

  const prompt = [
    `너는 Threads 게시물의 작가이자 계정 운영자다.`,
    `[게시글 원문]: "${postContext.slice(0, 300)}"`,
    `[독자 댓글] (@${authorUsername}): "${commentText}"`,
    isCreator
      ? `[특수 지침: 제작자/관리자 본인 댓글] 더 반갑고 위트 있게 티키타카를 나눌 것.`
      : `[지침]: 진정성 있고 짧고 경쾌하게 1~2문장(60~120자 내외)으로 답글을 작성하라. 기계적인 '감사합니다' 반복 금지. 친근한 구어체 사용.`,
  ].join("\n");

  try {
    const response = await client.messages.create({
      model: process.env.ANTHROPIC_GENERATION_MODEL ?? "claude-haiku-4-5-20251001",
      max_tokens: 200,
      temperature: 0.85,
      messages: [{ role: "user", content: prompt }],
    });

    const reply = (response.content[0] as { text: string }).text.trim();
    return reply;
  } catch {
    // Fallback simple acknowledgement if LLM fails
    return `공감해주셔서 고마워요! 오늘도 좋은 하루 보내세요 :)`;
  }
}

/**
 * Scans recent posts for unanswered comments, enforces the 20-Cap gate,
 * and creates DRAFT entries in ThreadReply table.
 */
export async function scanAndDraftRepliesForBrand(
  brandId: string,
  credentials: ThreadsCredentials,
  options?: {
    maxCapPerPost?: number;
    creatorHandle?: string;
    fetchFn?: typeof fetch;
  }
): Promise<ScanRepliesResult> {
  const maxCap = options?.maxCapPerPost ?? THREADS_MAX_UNANSWERED_REPLIES_PER_POST;
  const customFetch = options?.fetchFn ?? fetch;

  const result: ScanRepliesResult = {
    brandId,
    scannedPosts: 0,
    totalRepliesFound: 0,
    draftsCreated: 0,
    truncatedThreads: [],
    mentionsAccessible: false,
    errors: [],
  };

  // Find recent published posts from last 3 days
  const threeDaysAgo = new Date();
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

  const posts = await prisma.post.findMany({
    where: {
      brandId,
      status: "PUBLISHED",
      threadsId: { not: null },
      publishedAt: { gte: threeDaysAgo },
    },
    orderBy: { publishedAt: "desc" },
    take: 10,
  });

  result.scannedPosts = posts.length;

  for (const post of posts) {
    if (!post.threadsId) continue;

    try {
      const { replies, totalAvailable, wasTruncated } = await fetchPostRepliesWithCap(
        post.threadsId,
        credentials,
        maxCap,
        customFetch
      );

      result.totalRepliesFound += totalAvailable;

      if (wasTruncated) {
        result.truncatedThreads.push({
          postThreadsId: post.threadsId,
          totalReplies: totalAvailable,
          kept: replies.length,
        });
      }

      for (const reply of replies) {
        // Check if reply already exists in DB
        const existing = await prisma.threadReply.findUnique({
          where: { replyThreadsId: reply.id },
        });

        if (!existing) {
          const draftText = await generateDraftReplyContent(
            reply.username,
            reply.text,
            post.content,
            { creatorHandle: options?.creatorHandle }
          );

          await prisma.threadReply.create({
            data: {
              brandId,
              postThreadsId: post.threadsId,
              replyThreadsId: reply.id,
              authorUsername: reply.username,
              authorText: reply.text,
              replyText: draftText,
              status: "DRAFT",
              isMention: false,
              isFollowUp: false,
            },
          });

          result.draftsCreated++;
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to scan post replies";
      result.errors.push(`Post ${post.id}: ${msg}`);
    }
  }

  // Scan mentions safely
  const mentionsResult = await fetchMentionsSafely(credentials, customFetch);
  result.mentionsAccessible = mentionsResult.accessible;
  if (!mentionsResult.accessible && mentionsResult.error) {
    result.errors.push(`Mentions: ${mentionsResult.error}`);
  } else {
    for (const mention of mentionsResult.mentions) {
      const existing = await prisma.threadReply.findUnique({
        where: { replyThreadsId: mention.id },
      });

      if (!existing) {
        const draftText = await generateDraftReplyContent(
          mention.username,
          mention.text,
          mention.text,
          { creatorHandle: options?.creatorHandle }
        );

        await prisma.threadReply.create({
          data: {
            brandId,
            postThreadsId: mention.id,
            replyThreadsId: mention.id,
            authorUsername: mention.username,
            authorText: mention.text,
            replyText: draftText,
            status: "DRAFT",
            isMention: true,
            isFollowUp: false,
          },
        });

        result.draftsCreated++;
      }
    }
  }

  return result;
}

/**
 * Publishes an approved DRAFT reply to Threads via reply_to_id.
 */
export async function publishApprovedReply(
  replyId: string,
  credentials: ThreadsCredentials
): Promise<{ success: boolean; publishedThreadsId?: string; error?: string }> {
  const record = await prisma.threadReply.findUnique({
    where: { id: replyId },
  });

  if (!record) {
    throw new Error(`ThreadReply ${replyId} not found`);
  }

  if (!record.replyText) {
    throw new Error(`ThreadReply ${replyId} has no replyText`);
  }

  try {
    const publishedThreadsId = await publishReplyWithRetryForBrand(
      record.replyText,
      record.replyThreadsId,
      credentials
    );

    await prisma.threadReply.update({
      where: { id: replyId },
      data: {
        status: "PUBLISHED",
      },
    });

    return { success: true, publishedThreadsId };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Failed to publish reply";
    return { success: false, error: errorMsg };
  }
}
