import { prisma } from "@/lib/prisma";
import {
  evaluateShadowbanHealth,
  type PostReachRecord,
  type ShadowbanHealthReport,
} from "@/lib/shadowban-health-probe";

/**
 * Scores one brand's recent reach against its baseline. The manual re-evaluate button and the daily cron both call
 * this, so they always look at the same posts.
 */
export async function evaluateBrandShadowban(brandId: string): Promise<ShadowbanHealthReport> {
  const posts = await prisma.post.findMany({
    where: {
      brandId,
      status: "PUBLISHED",
      publishedAt: { not: null },
    },
    orderBy: { publishedAt: "desc" },
    take: 25,
    select: {
      id: true,
      views: true,
      likes: true,
      replies: true,
      publishedAt: true,
    },
  });

  const history: PostReachRecord[] = posts
    .filter((p) => p.publishedAt !== null)
    .map((p) => ({
      postId: p.id,
      views: p.views,
      likes: p.likes ?? 0,
      replies: p.replies ?? 0,
      publishedAt: p.publishedAt as Date,
    }));

  return evaluateShadowbanHealth(history, {
    minHoursSincePublished: 6,
    minTotalPostsForColdStart: 5,
  });
}
