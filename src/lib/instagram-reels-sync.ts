import { startOfPublishDay } from "@/lib/account-trust-ramp";
import { sendSystemAlert } from "@/lib/alert-service";
import {
  createReelsContainer,
  getContainerStatus,
  getRemainingPublishQuota,
  publishContainer,
  type InstagramCredentials,
} from "@/lib/instagram-api";
import { isVideoMediaUrl } from "@/lib/media-url";
import { prisma } from "@/lib/prisma";
import { parseBrandConfig } from "@/types/brand";

export const INSTAGRAM_CAPTION_MAX = 2200;
export const INSTAGRAM_MAX_ATTEMPTS = 3;
export const REEL_STALE_MS = 3 * 24 * 60 * 60 * 1000;

export interface ReelsTickResult {
  advanced: number;
  published: string[];
  started: string | null;
  skippedStale: number;
  failed: string[];
}

interface ReelsBrand {
  id: string;
  name: string;
  brandConfig: string;
  instagramConnectedAt: Date;
}

interface ReelAttempt {
  id: string;
  instagramAttempts: number;
}

interface ProcessingReel extends ReelAttempt {
  instagramContainerId: string | null;
}

interface AdvanceResult {
  advanced: number;
  published: string[];
  inProgress: number;
  failed: string[];
}

type AdvanceOutcome = "published" | "in_progress" | "failed";

export function buildInstagramCaption(content: string, captionSuffix: string): string {
  if (!captionSuffix) return content.slice(0, INSTAGRAM_CAPTION_MAX);
  const tail = `\n\n${captionSuffix}`;
  const body = content.slice(0, Math.max(0, INSTAGRAM_CAPTION_MAX - tail.length));
  return `${body}${tail}`.slice(0, INSTAGRAM_CAPTION_MAX);
}

export function selectReelCandidate<T extends { imageUrls: string; publishedAt: Date | null }>(
  posts: T[],
  options: { connectedAt: Date; now: Date },
): T | null {
  const staleBefore = options.now.getTime() - REEL_STALE_MS;
  const eligible = posts.filter((post) => {
    const publishedAt = post.publishedAt?.getTime();
    if (publishedAt === undefined) return false;
    return publishedAt >= options.connectedAt.getTime() && publishedAt >= staleBefore && findVideoUrl(post.imageUrls) !== null;
  });
  eligible.sort((left, right) => (left.publishedAt?.getTime() ?? 0) - (right.publishedAt?.getTime() ?? 0));
  return eligible[0] ?? null;
}

export async function runInstagramReelsTick(
  brand: ReelsBrand,
  credentials: InstagramCredentials,
  now: Date,
): Promise<ReelsTickResult> {
  const advance = await advanceProcessingReels(brand, credentials, now);
  const skippedStale = await skipStaleReels(brand, now);
  const blocked = advance.published.length > 0 || advance.inProgress > 0;
  const start = blocked ? { started: null, failed: [] } : await startNextReel(brand, credentials, now);
  return {
    advanced: advance.advanced,
    published: advance.published,
    started: start.started,
    skippedStale,
    failed: [...advance.failed, ...start.failed],
  };
}

/** Step 1: move PROCESSING reels forward (publish FINISHED containers, count failures). */
async function advanceProcessingReels(brand: ReelsBrand, credentials: InstagramCredentials, now: Date): Promise<AdvanceResult> {
  const reels: ProcessingReel[] = await prisma.post.findMany({
    where: { brandId: brand.id, instagramStatus: "PROCESSING" },
    select: { id: true, instagramContainerId: true, instagramAttempts: true },
  });
  const result: AdvanceResult = { advanced: 0, published: [], inProgress: 0, failed: [] };
  for (const reel of reels) {
    const outcome = await advanceReel(brand, credentials, reel, now);
    if (outcome === "in_progress") result.inProgress += 1;
    else result.advanced += 1;
    if (outcome === "published") result.published.push(reel.id);
    if (outcome === "failed") result.failed.push(reel.id);
  }
  return result;
}

async function advanceReel(brand: ReelsBrand, credentials: InstagramCredentials, reel: ProcessingReel, now: Date): Promise<AdvanceOutcome> {
  const containerId = reel.instagramContainerId;
  if (!containerId) return recordReelFailure(brand, reel, "Claimed without a container (previous run died mid-creation)");
  try {
    const status = await getContainerStatus(containerId, credentials.accessToken);
    if (status === "IN_PROGRESS") return "in_progress";
    if (status === "ERROR" || status === "EXPIRED") return recordReelFailure(brand, reel, `Container status ${status}`);
    // PUBLISHED means Instagram already posted it (a previous run died before saving): record it, never re-publish.
    const mediaId = status === "FINISHED" ? await publishContainer(credentials, containerId) : null;
    await prisma.post.update({
      where: { id: reel.id },
      data: { instagramStatus: "PUBLISHED", instagramMediaId: mediaId, instagramPublishedAt: now, instagramError: null },
    });
    return "published";
  } catch (error) {
    return recordReelFailure(brand, reel, error instanceof Error ? error.message : "Unknown error");
  }
}

/** One failed attempt: reset for a retry next tick, or mark FAILED and alert on the last attempt. */
async function recordReelFailure(brand: ReelsBrand, reel: ReelAttempt, reason: string): Promise<"failed"> {
  const attempts = reel.instagramAttempts + 1;
  const where = { id: reel.id, instagramStatus: "PROCESSING" };
  if (attempts < INSTAGRAM_MAX_ATTEMPTS) {
    await prisma.post.updateMany({
      where,
      data: { instagramStatus: null, instagramContainerId: null, instagramAttempts: attempts, instagramError: reason },
    });
    return "failed";
  }
  const { count } = await prisma.post.updateMany({
    where,
    data: { instagramStatus: "FAILED", instagramAttempts: attempts, instagramError: reason },
  });
  if (count > 0) await alertReelFailed(brand, reel.id, reason);
  return "failed";
}

async function alertReelFailed(brand: ReelsBrand, postId: string, reason: string): Promise<void> {
  await sendSystemAlert({
    level: "error",
    title: `Instagram Reel Failed (${brand.name})`,
    message: `Reel cross-post failed ${INSTAGRAM_MAX_ATTEMPTS} times for post ${postId}: ${reason}`,
    brandName: brand.name,
    postId,
  });
}

/** Step 2: reels still unposted 3 days after Threads publish are SKIPPED so old ones never surface. */
async function skipStaleReels(brand: ReelsBrand, now: Date): Promise<number> {
  const stalePosts = await prisma.post.findMany({
    where: {
      brandId: brand.id,
      status: "PUBLISHED",
      instagramStatus: null,
      publishedAt: { gte: brand.instagramConnectedAt, lt: new Date(now.getTime() - REEL_STALE_MS) },
    },
    select: { id: true, imageUrls: true },
  });
  const ids = stalePosts.filter((post) => findVideoUrl(post.imageUrls) !== null).map((post) => post.id);
  if (ids.length === 0) return 0;
  const { count } = await prisma.post.updateMany({
    where: { id: { in: ids }, instagramStatus: null },
    data: { instagramStatus: "SKIPPED" },
  });
  return count;
}

/** Step 3: claim the earliest eligible reel and create its container (one reel per brand per KST day). */
async function startNextReel(
  brand: ReelsBrand,
  credentials: InstagramCredentials,
  now: Date,
): Promise<{ started: string | null; failed: string[] }> {
  const none = { started: null, failed: [] };
  if (await hasReelTodayOrInFlight(brand.id, now)) return none;
  const quota = await getRemainingPublishQuota(credentials);
  if (quota !== null && quota <= 0) return none;
  const reel = await findReelCandidate(brand, now);
  if (!reel) return none;
  const claim = await prisma.post.updateMany({
    where: { id: reel.id, instagramStatus: null },
    data: { instagramStatus: "PROCESSING" },
  });
  if (claim.count === 0) return none;
  return createContainerForReel(brand, credentials, reel);
}

async function hasReelTodayOrInFlight(brandId: string, now: Date): Promise<boolean> {
  const existing = await prisma.post.findFirst({
    where: {
      brandId,
      OR: [{ instagramPublishedAt: { gte: startOfPublishDay(now) } }, { instagramStatus: "PROCESSING" }],
    },
    select: { id: true },
  });
  return existing !== null;
}

async function findReelCandidate(brand: ReelsBrand, now: Date) {
  const posts = await prisma.post.findMany({
    where: {
      brandId: brand.id,
      status: "PUBLISHED",
      instagramStatus: null,
      publishedAt: { gte: new Date(now.getTime() - REEL_STALE_MS) },
    },
    select: { id: true, content: true, imageUrls: true, publishedAt: true, instagramAttempts: true },
  });
  return selectReelCandidate(posts, { connectedAt: brand.instagramConnectedAt, now });
}

async function createContainerForReel(
  brand: ReelsBrand,
  credentials: InstagramCredentials,
  reel: ReelAttempt & { content: string; imageUrls: string },
): Promise<{ started: string | null; failed: string[] }> {
  try {
    const caption = buildInstagramCaption(reel.content, parseBrandConfig(brand.brandConfig).instagram.captionSuffix);
    const videoUrl = findVideoUrl(reel.imageUrls) ?? "";
    const containerId = await createReelsContainer(credentials, { videoUrl, caption });
    await prisma.post.update({ where: { id: reel.id }, data: { instagramContainerId: containerId } });
    return { started: reel.id, failed: [] };
  } catch (error) {
    await recordReelFailure(brand, reel, error instanceof Error ? error.message : "Unknown error");
    return { started: null, failed: [reel.id] };
  }
}

/** Post.imageUrls is a JSON string array; anything unreadable counts as "no video". */
function findVideoUrl(imageUrls: string): string | null {
  try {
    const parsed: unknown = JSON.parse(imageUrls);
    if (!Array.isArray(parsed)) return null;
    const video: unknown = parsed.find((url: unknown) => typeof url === "string" && isVideoMediaUrl(url));
    return typeof video === "string" ? video : null;
  } catch {
    return null;
  }
}
