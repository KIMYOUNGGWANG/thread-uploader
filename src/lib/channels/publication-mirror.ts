import type { Post } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type ChannelPlatform = "threads" | "instagram";

export type PublicationStatus =
  | "QUEUED" | "READY_MANUAL" | "PUBLISHING" | "PUBLISHED" | "FAILED" | "SKIPPED" | "ARCHIVED";

export interface PublicationMirror {
  status: PublicationStatus;
  externalId: string | null;
  publishedAt: Date | null;
  platformData: Record<string, unknown>;
  attempts: number;
  errorLog: string | null;
  views: number | null;
  likes: number | null;
  replies: number | null;
  reposts: number | null;
  metricsAt: Date | null;
}

export type ThreadsMirrorPost = Pick<Post,
  | "id" | "brandId" | "status" | "threadsId" | "publishedAt" | "errorLog" | "threadRootId"
  | "threadPartIds" | "threadPartsPosted" | "threadTotalParts"
  | "views" | "likes" | "replies" | "reposts" | "metricsAt">;

export type InstagramMirrorPost = Pick<Post,
  | "id" | "brandId" | "instagramStatus" | "instagramContainerId" | "instagramMediaId"
  | "instagramPublishedAt" | "instagramAttempts" | "instagramError">;

const THREADS_SELECT = {
  id: true, brandId: true, status: true, threadsId: true, publishedAt: true, errorLog: true,
  threadRootId: true, threadPartIds: true, threadPartsPosted: true, threadTotalParts: true,
  views: true, likes: true, replies: true, reposts: true, metricsAt: true,
} as const;

const INSTAGRAM_SELECT = {
  id: true, brandId: true, instagramStatus: true, instagramContainerId: true, instagramMediaId: true,
  instagramPublishedAt: true, instagramAttempts: true, instagramError: true,
} as const;

function parseIds(raw: string): string[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

function threadsStatus(post: ThreadsMirrorPost): PublicationStatus | null {
  switch (post.status) {
    case "PUBLISHED": return "PUBLISHED";
    case "PUBLISHING":
    case "PARTIAL_PUBLISHED": return "PUBLISHING";
    case "PARTIAL_FAILED":
    case "FAILED": return post.threadsId ? "FAILED" : null;
    case "ARCHIVED": return post.threadsId ? "ARCHIVED" : null;
    default: return null;
  }
}

export function threadsPublicationFromPost(post: ThreadsMirrorPost): PublicationMirror | null {
  const status = threadsStatus(post);
  if (!status) return null;
  return {
    status,
    externalId: post.threadsId,
    publishedAt: post.publishedAt,
    platformData: {
      threadRootId: post.threadRootId,
      threadPartIds: parseIds(post.threadPartIds),
      threadPartsPosted: post.threadPartsPosted,
      threadTotalParts: post.threadTotalParts,
    },
    attempts: 0,
    errorLog: post.errorLog,
    views: post.views,
    likes: post.likes,
    replies: post.replies,
    reposts: post.reposts,
    metricsAt: post.metricsAt,
  };
}

function instagramStatus(post: InstagramMirrorPost): PublicationStatus | null {
  switch (post.instagramStatus) {
    case "PROCESSING": return "PUBLISHING";
    case "PUBLISHED":
    case "FAILED":
    case "SKIPPED": return post.instagramStatus;
    case null: return post.instagramAttempts > 0 ? "QUEUED" : null;
    default: return null;
  }
}

export function instagramPublicationFromPost(post: InstagramMirrorPost): PublicationMirror | null {
  const status = instagramStatus(post);
  if (!status) return null;
  return {
    status,
    externalId: post.instagramMediaId,
    publishedAt: post.instagramPublishedAt,
    platformData: { containerId: post.instagramContainerId },
    attempts: post.instagramAttempts,
    errorLog: post.instagramError,
    views: null,
    likes: null,
    replies: null,
    reposts: null,
    metricsAt: null,
  };
}

// Tokens stay on Brand in this phase, so the ChannelAccount token columns are left empty.
export async function ensureLegacyChannelAccount(brandId: string, platform: ChannelPlatform): Promise<string> {
  const brand = await prisma.brand.findUnique({
    where: { id: brandId },
    select: { threadsUserId: true, instagramUserId: true, instagramUsername: true, instagramConnectedAt: true },
  });
  if (!brand) throw new Error(`Brand not found: ${brandId}`);

  const existing = await prisma.channelAccount.findFirst({ where: { brandId, platform }, select: { id: true } });
  if (existing) return existing.id;

  const identity = platform === "threads"
    ? { externalUserId: brand.threadsUserId }
    : { externalUserId: brand.instagramUserId, handle: brand.instagramUsername, connectedAt: brand.instagramConnectedAt };
  const created = await prisma.channelAccount.create({
    data: { brandId, platform, mode: "direct", ...identity },
    select: { id: true },
  });
  return created.id;
}

async function writeMirror(postId: string, brandId: string, platform: ChannelPlatform, mirror: PublicationMirror) {
  const channelAccountId = await ensureLegacyChannelAccount(brandId, platform);
  const data = { ...mirror, platformData: JSON.stringify(mirror.platformData) };
  await prisma.publication.upsert({
    where: { postId_channelAccountId: { postId, channelAccountId } },
    create: { postId, channelAccountId, ...data },
    update: data,
  });
}

export async function mirrorThreadsFromPost(postId: string): Promise<void> {
  try {
    const post = await prisma.post.findUnique({ where: { id: postId }, select: THREADS_SELECT });
    const mirror = post && threadsPublicationFromPost(post);
    if (post && mirror) await writeMirror(postId, post.brandId, "threads", mirror);
  } catch (error: unknown) {
    console.error("[publication-mirror] threads", postId, error);
  }
}

export async function mirrorInstagramFromPost(postId: string): Promise<void> {
  try {
    const post = await prisma.post.findUnique({ where: { id: postId }, select: INSTAGRAM_SELECT });
    const mirror = post && instagramPublicationFromPost(post);
    if (post && mirror) await writeMirror(postId, post.brandId, "instagram", mirror);
  } catch (error: unknown) {
    console.error("[publication-mirror] instagram", postId, error);
  }
}

// REEL_STALE_MS (3 days) + 1 day margin; not imported from instagram-reels-sync to avoid a circular import.
const INSTAGRAM_MIRROR_WINDOW_MS = 4 * 24 * 60 * 60 * 1000;

/** Re-mirror every recently active Instagram post of a brand (the reels tick writes state in many places). */
export async function mirrorRecentInstagram(brandId: string, now: Date): Promise<void> {
  try {
    const posts = await prisma.post.findMany({
      where: {
        brandId,
        OR: [{ instagramStatus: { not: null } }, { instagramAttempts: { gt: 0 } }],
        publishedAt: { gte: new Date(now.getTime() - INSTAGRAM_MIRROR_WINDOW_MS) },
      },
      select: { id: true },
    });
    for (const { id } of posts) await mirrorInstagramFromPost(id);
  } catch (error: unknown) {
    console.error("[publication-mirror] instagram-recent", brandId, error);
  }
}
