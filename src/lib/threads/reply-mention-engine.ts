import { prisma } from "@/lib/prisma";
import { type ThreadsCredentials, publishReplyWithRetryForBrand } from "@/lib/threads-api";
import Anthropic from "@anthropic-ai/sdk";
import { CLAUDE_TEXT_MODEL, readMessageText } from "@/lib/claude-text";

export const THREADS_MAX_UNANSWERED_REPLIES_PER_POST = 20;

export interface RawThreadsReply {
  id: string;
  text: string;
  username: string;
  timestamp?: string;
  isMention?: boolean;
}

export const SCAN_MAX_DRAFTS_PER_RUN = 5;

export interface ScanRepliesResult {
  brandId: string;
  scannedPosts: number;
  totalRepliesFound: number;
  draftsCreated: number;
  /** Comments that produced no draft this run (LLM failure); they are retried next run. */
  draftsSkipped: number;
  truncatedThreads: Array<{ postThreadsId: string; totalReplies: number; kept: number }>;
  mentionsAccessible: boolean;
  errors: string[];
}

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  timeout: 15000,
});

// A reply loop that answers its own first comment or "맞팔" bots reads as spam; these never get a draft.
const INELIGIBLE_REPLY_PATTERNS = [
  /https?:\/\/|www\./i,
  /맞팔|선팔|팔로우\s*(해|부탁|구해)|follow\s*(back|4|for)|f4f|dm\s*me/i,
];

export function isReaderReplyEligible(reply: RawThreadsReply, ownUsername?: string | null): boolean {
  if (ownUsername && reply.username.replace(/^@/, "").toLowerCase() === ownUsername.replace(/^@/, "").toLowerCase()) return false;
  const text = reply.text.trim();
  if (text.length < 2) return false;
  return !INELIGIBLE_REPLY_PATTERNS.some((pattern) => pattern.test(text));
}

/**
 * The account's own handle, so the scan can drop the brand's first comments. Null when the lookup fails;
 * scanAndDraftRepliesForBrand then skips post replies for the run rather than risk replying to itself.
 */
export async function fetchOwnUsername(credentials: ThreadsCredentials, fetchFn = fetch): Promise<string | null> {
  try {
    const response = await fetchFn(`https://graph.threads.net/v1.0/me?fields=username&access_token=${credentials.accessToken}`);
    if (!response.ok) return null;
    const data: { username?: string } = await response.json();
    return data.username ?? null;
  } catch {
    return null;
  }
}

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
  options?: { creatorHandle?: string; brandTone?: string; language?: "ko" | "en" }
): Promise<string | null> {
  const isCreator = options?.creatorHandle && authorUsername.replace("@", "").toLowerCase() === options.creatorHandle.replace("@", "").toLowerCase();
  const toneRule = options?.language === "en"
    ? "[Rules]: Reply in casual English, 1-2 sentences. Answer the question first if there is one. No 'thanks for your comment' filler, no links, no promotion, no hashtags. Output only the reply."
    : "[지침]: 글과 같은 반말 독백체(~임, ~더라, ~냐?)로 1~2문장(60~120자). 존댓말(~해요/~합니다) 금지. 질문이면 답부터, 아니면 한 번 더 궁금하게 만드는 되물음 하나. 기계적인 '감사합니다' 금지. 링크/홍보/해시태그 금지. 답글 텍스트만 출력.";

  const prompt = [
    `너는 Threads 게시물의 작가이자 계정 운영자다.`,
    `[게시글 원문]: "${postContext.slice(0, 300)}"`,
    `[독자 댓글] (@${authorUsername}): "${commentText}"`,
    isCreator
      ? `[특수 지침: 제작자/관리자 본인 댓글] 더 반갑고 위트 있게 티키타카를 나눌 것.`
      : toneRule,
  ].join("\n");

  try {
    const response = await client.messages.create({
      model: CLAUDE_TEXT_MODEL,
      max_tokens: 1500,
      thinking: { type: "disabled" }, // short-form copy; thinking only adds latency and output tokens
      output_config: { effort: "low" },
      messages: [{ role: "user", content: prompt }],
    });

    const text = readMessageText(response).trim();
    return text.length > 0 ? text : null;
  } catch (error) {
    // No canned fallback: a fixed sentence auto-posted under every comment reads as a bot (PR #20 review).
    // Null leaves no row, so the next hourly run retries this comment.
    console.warn(`[reply-mention-engine] draft generation failed for @${authorUsername}:`, error);
    return null;
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
    language?: "ko" | "en";
    /** The brand's own handle; fetched from /me when omitted. Null skips post replies for the run. */
    ownUsername?: string | null;
    maxDraftsPerRun?: number;
    fetchFn?: typeof fetch;
  }
): Promise<ScanRepliesResult> {
  const maxCap = options?.maxCapPerPost ?? THREADS_MAX_UNANSWERED_REPLIES_PER_POST;
  const customFetch = options?.fetchFn ?? fetch;
  const ownUsername = options?.ownUsername === undefined ? await fetchOwnUsername(credentials, customFetch) : options.ownUsername;
  const maxDrafts = options?.maxDraftsPerRun ?? SCAN_MAX_DRAFTS_PER_RUN;

  const result: ScanRepliesResult = {
    brandId,
    scannedPosts: 0,
    totalRepliesFound: 0,
    draftsCreated: 0,
    draftsSkipped: 0,
    truncatedThreads: [],
    mentionsAccessible: false,
    errors: [],
  };

  // Breakout posts keep collecting replies for a week or more, so the window is wider than the 3-6 posts/day.
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  // Without the brand's own handle every reply looks like a reader's, including the brand's first comment.
  const posts = ownUsername
    ? await prisma.post.findMany({
        where: {
          brandId,
          status: "PUBLISHED",
          threadsId: { not: null },
          publishedAt: { gte: sevenDaysAgo },
        },
        orderBy: { publishedAt: "desc" },
        take: 25,
      })
    : [];
  if (!ownUsername) result.errors.push("Own username unavailable (/me failed): post replies skipped this run");

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
        if (result.draftsCreated >= maxDrafts) break;
        if (!isReaderReplyEligible(reply, ownUsername)) continue;
        // Check if reply already exists in DB
        const existing = await prisma.threadReply.findUnique({
          where: { replyThreadsId: reply.id },
        });

        if (!existing) {
          const draftText = await generateDraftReplyContent(
            reply.username,
            reply.text,
            post.content,
            { creatorHandle: options?.creatorHandle, language: options?.language }
          );
          if (draftText === null) {
            result.draftsSkipped++;
            continue;
          }

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
          { creatorHandle: options?.creatorHandle, language: options?.language }
        );
        if (draftText === null) {
          result.draftsSkipped++;
          continue;
        }

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

// The cron route has 60s; each publish sleeps ~6s. 3 per hourly run is still 72 replies/day.
export const AUTO_REPLY_MAX_PER_RUN = 3;
export const AUTO_REPLY_MAX_AGE_HOURS = 48;

export interface AutoReplyResult {
  brandId: string;
  published: number;
  failed: number;
  /** Rows left in PUBLISHING by an interrupted run; never auto-retried, check them by hand. */
  stuck: number;
  errors: string[];
}

/**
 * Publishes reader-reply drafts without human approval: newest-post comments first, capped per run so one
 * run never bursts, and drafts older than the window stay DRAFT for manual review (a late reply reads as a bot).
 * Mentions are left for approval: their context is another account's post.
 */
export async function publishDueDraftReplies(
  brandId: string,
  credentials: ThreadsCredentials,
  options?: { maxPerRun?: number; maxAgeHours?: number; now?: Date }
): Promise<AutoReplyResult> {
  const maxPerRun = options?.maxPerRun ?? AUTO_REPLY_MAX_PER_RUN;
  const maxAgeHours = options?.maxAgeHours ?? AUTO_REPLY_MAX_AGE_HOURS;
  const now = options?.now ?? new Date();
  const since = new Date(now.getTime() - maxAgeHours * 60 * 60 * 1000);

  const due = await prisma.threadReply.findMany({
    where: { brandId, status: "DRAFT", isMention: false, createdAt: { gte: since }, replyText: { not: null } },
    orderBy: { createdAt: "asc" },
    take: maxPerRun,
  });

  const stuck = await prisma.threadReply.count({ where: { brandId, status: "PUBLISHING" } });
  const result: AutoReplyResult = { brandId, published: 0, failed: 0, stuck, errors: [] };
  for (const draft of due) {
    const outcome = await publishApprovedReply(draft.id, credentials);
    if (outcome.success) {
      result.published++;
    } else {
      result.failed++;
      result.errors.push(`${draft.id}: ${outcome.error ?? "publish failed"}`);
      await prisma.threadReply.update({ where: { id: draft.id }, data: { status: "FAILED" } });
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
    // Claim the row first: if the route is killed between the Threads call and the final update, the row
    // stays PUBLISHING and the next run cannot post the same reply twice.
    await prisma.threadReply.update({ where: { id: replyId }, data: { status: "PUBLISHING" } });

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
