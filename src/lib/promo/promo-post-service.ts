import { prisma } from "@/lib/prisma";
import { isVideoMediaUrl } from "@/lib/media-url";

export interface PromoPostItem {
  brandSlug: string;
  videoUrl: string;
  content: string;
  commentTemplate: string;
  landingPath: string;
  format: string;
  topic: string;
}

export type PromoPostResult =
  | { brandSlug: string; postId: string }
  | { brandSlug: string; skipped: "brand_not_found" | "already_queued" };

const SITE_ORIGIN = "https://cosmicpath.app";
const MAX_CONTENT_CHARS = 480; // longer captions get split into a Threads chain
const ITEM_KEYS = ["brandSlug", "videoUrl", "content", "commentTemplate", "landingPath", "format", "topic"] as const;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

function parseItem(value: unknown): PromoPostItem | null {
  if (!isRecord(value) || !ITEM_KEYS.every((key) => typeof value[key] === "string")) return null;
  const item: PromoPostItem = {
    brandSlug: String(value.brandSlug), videoUrl: String(value.videoUrl), content: String(value.content),
    commentTemplate: String(value.commentTemplate), landingPath: String(value.landingPath), format: String(value.format), topic: String(value.topic),
  };
  const contentLength = [...item.content].length;
  const valid = item.videoUrl.startsWith("https://") && isVideoMediaUrl(item.videoUrl)
    && contentLength > 0 && contentLength <= MAX_CONTENT_CHARS
    && item.commentTemplate.includes("{{link}}") && item.landingPath.startsWith("/start");
  return valid ? item : null;
}

export function parsePromoPostsBody(body: unknown): { date: string; items: PromoPostItem[] } | { error: string } {
  if (!isRecord(body) || typeof body.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(body.date)) return { error: "date (YYYY-MM-DD) is required" };
  if (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > 4) return { error: "items must have 1-4 entries" };
  const items = body.items.map(parseItem);
  if (items.some((item) => item === null)) return { error: "invalid item: https .mp4 videoUrl, 1-480 char content, {{link}} comment and /start landing path required" };
  return { date: body.date, items: items.filter((item): item is PromoPostItem => item !== null) };
}

export function buildPromoLink(landingPath: string, postId: string): string {
  const url = new URL(landingPath, SITE_ORIGIN);
  url.searchParams.set("utm_source", "threads");
  url.searchParams.set("utm_campaign", "promo-rotation");
  url.searchParams.set("utm_content", postId);
  return url.toString();
}

async function queueOne(date: string, item: PromoPostItem): Promise<PromoPostResult> {
  const brand = await prisma.brand.findUnique({ where: { slug: item.brandSlug } });
  if (!brand) return { brandSlug: item.brandSlug, skipped: "brand_not_found" };
  const formulaId = `video:promo:${date}`;
  const existing = await prisma.post.findFirst({ where: { brandId: brand.id, formulaId } });
  if (existing) return { brandSlug: item.brandSlug, skipped: "already_queued" };
  const post = await prisma.post.create({
    data: {
      brandId: brand.id, content: item.content, imageUrls: JSON.stringify([item.videoUrl]), scheduledAt: new Date(),
      status: "NEEDS_REVIEW", formulaId, topic: `${item.format}:${item.topic}`, qualityReasons: JSON.stringify(["영상 포스트: 승인 후 발행"]),
    },
  });
  const linkUrl = buildPromoLink(item.landingPath, post.id);
  await prisma.post.update({
    where: { id: post.id },
    data: { linkUrl, utmContent: post.id, firstComment: item.commentTemplate.replace("{{link}}", linkUrl) },
  });
  return { brandSlug: item.brandSlug, postId: post.id };
}

// Sequential on purpose: at most 2 items per run, and it keeps the per-brand duplicate check simple.
export async function queuePromoPosts(date: string, items: PromoPostItem[]): Promise<PromoPostResult[]> {
  const results: PromoPostResult[] = [];
  for (const item of items) results.push(await queueOne(date, item));
  return results;
}
