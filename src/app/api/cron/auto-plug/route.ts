import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyCronSecret } from "@/lib/cron-auth";
import { fetchPostInsightsForBrand, getFreshBrandCredentials, publishReplyWithRetryForBrand } from "@/lib/threads-api";
import type { ThreadsCredentials } from "@/lib/threads-api";
import { buildShortRedirectUrl } from "@/lib/tracking-url";

export const maxDuration = 60;

// A post that takes off gets one link reply. Linking every post at publish cost reach
// (90-day median views: linked 79, unlinked 113), and three posts at 9k–23k views carried no link at all.
// ponytail: per-brand constants; move to brandConfig when a second brand needs auto-plug.
const AUTO_PLUG_BRANDS: Record<string, { landingUrl: string; comment: string }> = {
  cosmicpath: {
    landingUrl: "https://www.cosmicpath.app/start?entry=threads_auto_plug",
    comment: "내 생년월일이랑 태어난 시간으로 직접 확인해 보고 싶으면, 무료 진단부터 해봐 →\n{link}",
  },
};
// Final views ≥300 were 44 of 250 cosmicpath posts (2026-08..11): about one plug every two days at 3 posts/day.
const MIN_VIEWS = 300;
const MIN_REPLIES = 10;
const MIN_AGE_MS = 45 * 60 * 1000;
const MAX_AGE_MS = 48 * 60 * 60 * 1000;
const BATCH_SIZE = 10;

type BrandRow = { id: string; slug: string; accessToken: string | null; tokenExpiry: Date | null };
type Candidate = { id: string; threadsId: string | null; errorLog: string | null };
type PlugConfig = (typeof AUTO_PLUG_BRANDS)[string];

export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dryRun = request.nextUrl.searchParams.get("dryRun") === "1";
  const brands = await prisma.brand.findMany({
    where: { slug: { in: Object.keys(AUTO_PLUG_BRANDS) } },
    select: { id: true, slug: true, accessToken: true, tokenExpiry: true },
  });

  const results = [];
  for (const brand of brands) {
    try {
      results.push(await plugBrand(brand, dryRun));
    } catch (error) {
      results.push({ slug: brand.slug, error: errorMessage(error) });
    }
  }
  return NextResponse.json({ results });
}

async function plugBrand(brand: BrandRow, dryRun: boolean) {
  // An expired token can't be refreshed (only an OAuth reconnect fixes it), same as the replies cron.
  if (!brand.accessToken || !brand.tokenExpiry || brand.tokenExpiry <= new Date()) {
    return { slug: brand.slug, skipped: "token_expired" };
  }

  const now = Date.now();
  const posts: Candidate[] = await prisma.post.findMany({
    where: {
      brandId: brand.id,
      status: "PUBLISHED",
      threadsId: { not: null },
      // Null = no link yet: posts linked at publish and posts already plugged are both skipped.
      linkUrl: null,
      publishedAt: { gte: new Date(now - MAX_AGE_MS), lte: new Date(now - MIN_AGE_MS) },
    },
    orderBy: { publishedAt: "desc" },
    take: BATCH_SIZE,
    select: { id: true, threadsId: true, errorLog: true },
  });
  const plugged: { postId: string; views: number; replies: number }[] = [];
  const errors: { postId: string; error: string }[] = [];
  if (posts.length === 0) return { slug: brand.slug, checked: 0, plugged, errors, ...(dryRun ? { dryRun } : {}) };

  const credentials = await getFreshBrandCredentials(brand.id);
  const config = AUTO_PLUG_BRANDS[brand.slug];
  for (const post of posts) {
    try {
      const { views, replies } = await fetchPostInsightsForBrand(post.threadsId!, credentials.accessToken);
      if (views < MIN_VIEWS && replies < MIN_REPLIES) continue;
      if (dryRun || (await plugPost(post, config, credentials))) plugged.push({ postId: post.id, views, replies });
    } catch (error) {
      errors.push({ postId: post.id, error: errorMessage(error) });
    }
  }
  return { slug: brand.slug, checked: posts.length, plugged, errors, ...(dryRun ? { dryRun } : {}) };
}

async function plugPost(post: Candidate, config: PlugConfig, credentials: ThreadsCredentials): Promise<boolean> {
  const landing = new URL(config.landingUrl);
  landing.searchParams.set("utm_content", post.id);
  // Claim first: only the run that flips linkUrl from null may reply.
  const claim = await prisma.post.updateMany({
    where: { id: post.id, linkUrl: null },
    data: { linkUrl: landing.toString(), utmContent: post.id },
  });
  if (claim.count === 0) return false;

  // /r/<id> counts the click, then forwards to linkUrl with pid and utm params added.
  const link = buildShortRedirectUrl(process.env.APP_URL || "https://thread-uploader.vercel.app", post.id);
  try {
    await publishReplyWithRetryForBrand(config.comment.replace("{link}", link), post.threadsId!, credentials);
    return true;
  } catch (error) {
    // Keep the claim: the reply may have gone out before the error, and a retry could post the link twice.
    await prisma.post.update({
      where: { id: post.id },
      data: { errorLog: [post.errorLog, `Auto-plug failed: ${errorMessage(error)}`].filter(Boolean).join("\n") },
    });
    throw error;
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
