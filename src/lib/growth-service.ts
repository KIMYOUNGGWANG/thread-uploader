import { prisma } from "@/lib/prisma";
import {
  buildGrowthMemory,
  buildGrowthReport,
  calculatePerformanceScore,
  getPerformanceTier,
} from "@/lib/growth-learning";
import { computeAdaptiveFormulaWeights } from "@/lib/growth-feedback-loop";
import { parseBrandConfig } from "@/types/brand";

export async function learnBrandGrowth(brandId: string) {
  const brand = await prisma.brand.findUnique({
    where: { id: brandId },
    select: { id: brandId ? true : undefined, formulaWeights: true, brandConfig: true },
  });

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

  let updatedWeights: Record<string, number> | undefined;
  let promotedFormulas: string[] = [];
  let demotedFormulas: string[] = [];

  if (brand) {
    const config = parseBrandConfig(brand.brandConfig);
    const knownFormulaIds = config.formulas.map((f) => f.id);
    let currentWeights: Record<string, number> = {};
    try {
      currentWeights = brand.formulaWeights && brand.formulaWeights !== "{}"
        ? JSON.parse(brand.formulaWeights)
        : {};
    } catch {
      currentWeights = {};
    }

    const weightResult = computeAdaptiveFormulaWeights(currentWeights, posts, knownFormulaIds);
    updatedWeights = weightResult.updatedWeights;
    promotedFormulas = weightResult.promotedFormulas;
    demotedFormulas = weightResult.demotedFormulas;
  }

  await prisma.brand.update({
    where: { id: brandId },
    data: {
      growthMemory: JSON.stringify(memory),
      ...(updatedWeights && { formulaWeights: JSON.stringify(updatedWeights) }),
    },
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
    updatedWeights,
    promotedFormulas,
    demotedFormulas,
    ...buildGrowthReport(posts, memory),
  };
}
