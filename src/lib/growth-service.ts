import { prisma } from "@/lib/prisma";
import {
  buildGrowthMemory,
  buildGrowthReport,
  calculatePerformanceScore,
  getPerformanceTier,
} from "@/lib/growth-learning";

export async function learnBrandGrowth(brandId: string) {
  const posts = await prisma.post.findMany({
    where: {
      brandId,
      status: "PUBLISHED",
      metricsAt: { not: null },
      views: { not: null },
    },
    orderBy: { metricsAt: "desc" },
    take: 300,
  });

  const memory = buildGrowthMemory(posts);
  await prisma.brand.update({
    where: { id: brandId },
    data: { growthMemory: JSON.stringify(memory) },
  });

  const now = new Date();
  let scoredPosts = 0;
  let scoreWriteFailures = 0;

  for (const post of posts) {
    const performanceScore = calculatePerformanceScore(post);
    try {
      await prisma.post.update({
        where: { id: post.id },
        data: {
          performanceScore,
          performanceTier: getPerformanceTier(performanceScore),
          learnedAt: now,
        },
      });
      scoredPosts++;
    } catch (error) {
      scoreWriteFailures++;
      console.warn(
        `[growth] score write skipped for ${post.id}:`,
        error instanceof Error ? error.message : error
      );
    }
  }

  return {
    success: true,
    brandId,
    learnedPosts: posts.length,
    scoredPosts,
    scoreWriteFailures,
    ...buildGrowthReport(posts, memory),
  };
}
