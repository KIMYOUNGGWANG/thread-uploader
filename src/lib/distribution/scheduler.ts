import { prisma } from "@/lib/prisma";
import { parsePostForSlide } from "@/lib/card-parser";
import { parseBrandConfig } from "@/types/brand";
import { kstDate } from "@/lib/video-factory/kst";
import { getUploadAccounts } from "./accounts";
import { buildCardCaption, buildVideoCaption } from "./captions";
import { parseDistributionConfig } from "./config";
import { buildXText } from "./x-text";

const HOUR_MS = 60 * 60 * 1000;
// Drafts whose window closed longer ago than this are not uploaded (e.g. a channel connected later).
const VIDEO_STALE_MS = 48 * HOUR_MS;
const X_LOOKBACK_MS = 24 * HOUR_MS;
const CAROUSEL_MAX_SLIDES = 10;

type BrandRow = {
  id: string;
  slug: string;
  brandConfig: string;
  instagramAccessToken: string | null;
  instagramTokenExpiry: Date | null;
};

const BRAND_SELECT = { id: true, slug: true, brandConfig: true, instagramAccessToken: true, instagramTokenExpiry: true } as const;

/** Start of the current KST day as a UTC instant. */
export function kstDayStart(now: Date): Date {
  return new Date(`${kstDate(now)}T00:00:00+09:00`);
}

export function appBaseUrl(): string {
  return (process.env.APP_URL || "https://thread-uploader.vercel.app").replace(/\/+$/, "");
}

export function cardSlideUrls(postId: string, content: string, baseUrl = appBaseUrl()): string[] {
  const total = Math.min(parsePostForSlide(content, 0).totalSlides ?? 1, CAROUSEL_MAX_SLIDES);
  return Array.from({ length: total }, (_, i) => `${baseUrl}/api/cards/${postId}?slide=${i}&format=jpg`);
}

export interface ScheduleReport {
  videos: number;
  cards: number;
  x: number;
}

export async function scheduleVideoUploads(now: Date): Promise<number> {
  const drafts = await prisma.videoDraft.findMany({
    where: {
      status: "COMPLETED",
      canceledAt: null,
      videoUrl: { not: null },
      autoPublishAt: { lte: now, gte: new Date(now.getTime() - VIDEO_STALE_MS) },
      OR: [{ userVerdict: null }, { userVerdict: { not: "bad" } }],
      uploads: { none: {} },
    },
    include: { brand: { select: BRAND_SELECT } },
    orderBy: { autoPublishAt: "asc" },
    take: 20,
  });

  let created = 0;
  for (const draft of drafts) {
    const config = parseDistributionConfig(draft.brand.brandConfig);
    const accounts = await getUploadAccounts(draft.brand, now);
    const suffix = parseBrandConfig(draft.brand.brandConfig).instagram.captionSuffix;
    const rows = config.video.channels.flatMap((channel) => {
      const account = accounts.get(channel);
      if (!account) return [];
      return [{
        brandId: draft.brandId,
        channelAccountId: account.id,
        kind: "video",
        sourceKey: `video:${draft.id}`,
        videoDraftId: draft.id,
        // First version: TikTok stays private until the app passes audit (PRD Phase 1b).
        privacy: channel === "tiktok" ? "private" : "public",
        caption: buildVideoCaption(channel, draft.captions, draft.hashtags, channel === "instagram" ? suffix : ""),
        mediaUrls: JSON.stringify([draft.videoUrl]),
        scheduledAt: now,
      }];
    });
    if (rows.length === 0) continue;
    const result = await prisma.channelUpload.createMany({ data: rows, skipDuplicates: true });
    created += result.count;
  }
  return created;
}

export async function scheduleCardNews(now: Date, brands: BrandRow[]): Promise<number> {
  let created = 0;
  for (const brand of brands) {
    const config = parseDistributionConfig(brand.brandConfig);
    if (!config.cardNews.enabled) continue;
    const instagram = (await getUploadAccounts(brand, now)).get("instagram");
    if (!instagram) continue;

    const today = await prisma.channelUpload.count({
      where: { brandId: brand.id, kind: "carousel", createdAt: { gte: kstDayStart(now) } },
    });
    let room = config.cardNews.dailyCap - today;
    if (room <= 0) continue;

    const candidates = await prisma.post.findMany({
      where: {
        brandId: brand.id,
        status: "PUBLISHED",
        publishedAt: { gte: new Date(now.getTime() - config.cardNews.lookbackDays * 24 * HOUR_MS) },
        views: { gte: config.cardNews.minViews },
        channelUploads: { none: { kind: "carousel" } },
      },
      orderBy: { views: "desc" },
      take: 20,
      select: { id: true, content: true },
    });
    const suffix = parseBrandConfig(brand.brandConfig).instagram.captionSuffix;
    for (const post of candidates) {
      if (room <= 0) break;
      const mediaUrls = cardSlideUrls(post.id, post.content);
      if (mediaUrls.length < 2) continue;
      const result = await prisma.channelUpload.createMany({
        data: [{
          brandId: brand.id,
          channelAccountId: instagram.id,
          kind: "carousel",
          sourceKey: `cards:${post.id}`,
          postId: post.id,
          caption: buildCardCaption(post.content, suffix),
          mediaUrls: JSON.stringify(mediaUrls),
          scheduledAt: new Date(now.getTime() + config.cancelWindowHours * HOUR_MS),
        }],
        skipDuplicates: true,
      });
      created += result.count;
      room -= result.count;
    }
  }
  return created;
}

export async function scheduleXPosts(now: Date, brands: BrandRow[]): Promise<number> {
  let created = 0;
  for (const brand of brands) {
    const config = parseDistributionConfig(brand.brandConfig);
    if (!config.x.enabled) continue;
    const account = (await getUploadAccounts(brand, now)).get("x");
    if (!account) continue;

    const today = await prisma.channelUpload.count({
      where: { channelAccountId: account.id, createdAt: { gte: kstDayStart(now) } },
    });
    const room = config.x.dailyCap - today;
    if (room <= 0) continue;

    const posts = await prisma.post.findMany({
      where: {
        brandId: brand.id,
        status: "PUBLISHED",
        publishedAt: { gte: new Date(now.getTime() - X_LOOKBACK_MS) },
        channelUploads: { none: { channelAccountId: account.id } },
      },
      orderBy: { publishedAt: "asc" },
      take: room,
      select: { id: true, content: true },
    });
    const rows = posts.flatMap((post) => {
      const text = buildXText(post.content);
      return text ? [{
        brandId: brand.id,
        channelAccountId: account.id,
        kind: "text",
        sourceKey: `post:${post.id}`,
        postId: post.id,
        caption: text,
        scheduledAt: now,
      }] : [];
    });
    if (rows.length === 0) continue;
    created += (await prisma.channelUpload.createMany({ data: rows, skipDuplicates: true })).count;
  }
  return created;
}

export async function scheduleUploads(now: Date, slugs?: string[]): Promise<ScheduleReport> {
  const brands = await prisma.brand.findMany({
    where: slugs?.length ? { slug: { in: slugs } } : {},
    select: BRAND_SELECT,
  });
  return {
    videos: await scheduleVideoUploads(now),
    cards: await scheduleCardNews(now, brands),
    x: await scheduleXPosts(now, brands),
  };
}
