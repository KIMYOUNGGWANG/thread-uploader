import { prisma } from "@/lib/prisma";
import {
  buildGrowthMemory,
  buildGrowthReport,
  calculatePerformanceScore,
  getPerformanceTier,
} from "@/lib/growth-learning";
import {
  computeAdaptiveFormulaWeights,
  computeAdaptiveContextWeights,
  type ContextWeightAdjustmentResult,
} from "@/lib/growth-feedback-loop";
import { parseBrandConfig, serializeBrandConfigUpdate } from "@/types/brand";
import { DOMAIN_MATRICES } from "@/lib/context-matrix-engine";
import { getDomainPreset } from "@/lib/domain-registry";
import { QUOTA_TRACKS } from "@/lib/quota-bandit-router";
import {
  DEFAULT_INFORMATIVE_PRIORS,
  updateThompsonPriors,
  type FormulaPerformanceObservation,
} from "@/lib/thompson-sampling-router";

export async function learnBrandGrowth(brandId: string) {
  const brand = await prisma.brand.findUnique({
    where: { id: brandId },
    select: { id: brandId ? true : undefined, formulaWeights: true, brandConfig: true },
  });

  const posts = await prisma.post.findMany({
    where: {
      brandId,
      status: "PUBLISHED",
      OR: [
        { views: { not: null } },
        { metricsAt: { not: null } },
        { manualPaidConversions: { gt: 0 } },
        { performanceScore: { not: null } },
      ],
    },
    orderBy: { metricsAt: "desc" },
    take: 300,
  });

  // Filter out promotional / subsidized campaigns from organic formula weights to prevent data poisoning
  const organicPosts = posts.filter(
    (post) => !post.campaignId || !post.campaignId.toLowerCase().includes("promo")
  );

  const memory = buildGrowthMemory(organicPosts.length > 0 ? organicPosts : posts);

  let updatedWeights: Record<string, number> | undefined;
  let promotedFormulas: string[] = [];
  let demotedFormulas: string[] = [];
  let updatedBrandConfig: ReturnType<typeof parseBrandConfig> | undefined;
  let contextWeightResult: ContextWeightAdjustmentResult | undefined;

  if (brand) {
    const config = parseBrandConfig(brand.brandConfig);
    const domainPreset = getDomainPreset(config.qualityProfile);
    const domainFormulaIds = Object.values(domainPreset.trackFormulas).flatMap((formulas) => formulas.map((f) => f.id));
    const campaignFormulaIds = config.campaigns.flatMap((c) => c.formulas.map((f) => f.id));
    const quotaTrackFormulaIds = Object.values(QUOTA_TRACKS).flatMap((t) => t.defaultFormulas);
    const postFormulaIds = posts.map((p) => p.formulaId).filter((id): id is string => typeof id === "string" && id.length > 0);

    const knownFormulaIds = Array.from(new Set([
      ...config.formulas.map((f) => f.id),
      ...campaignFormulaIds,
      ...domainFormulaIds,
      ...quotaTrackFormulaIds,
      ...postFormulaIds,
    ]));

    let currentWeights: Record<string, number> = {};
    try {
      currentWeights = brand.formulaWeights && brand.formulaWeights !== "{}"
        ? JSON.parse(brand.formulaWeights)
        : {};
    } catch {
      currentWeights = {};
    }

    const weightResult = computeAdaptiveFormulaWeights(currentWeights, organicPosts.length > 0 ? organicPosts : posts, knownFormulaIds);
    updatedWeights = weightResult.updatedWeights;
    promotedFormulas = weightResult.promotedFormulas;
    demotedFormulas = weightResult.demotedFormulas;

    const domainKey = DOMAIN_MATRICES[config.qualityProfile] ? config.qualityProfile : "saju_viral";
    const matrix = DOMAIN_MATRICES[domainKey] ?? DOMAIN_MATRICES.saju_viral;

    contextWeightResult = computeAdaptiveContextWeights(
      config.contextWeights?.personaWeights ?? {},
      config.contextWeights?.frictionWeights ?? {},
      organicPosts.length > 0 ? organicPosts : posts,
      matrix.personas,
      matrix.frictions
    );

    const observations: FormulaPerformanceObservation[] = posts
      .filter((p) => Boolean(p.formulaId) && typeof p.views === "number")
      .map((p) => ({
        formulaId: p.formulaId!,
        views: p.views ?? 0,
        likes: p.likes ?? 0,
        replies: p.replies ?? 0,
        reposts: p.reposts ?? 0,
        linkClicks: p.clicks ?? 0,
        conversions: p.conversions ?? 0,
      }));

    const updatedPriors = updateThompsonPriors(
      config.thompsonPriors ?? DEFAULT_INFORMATIVE_PRIORS,
      observations
    );

    updatedBrandConfig = {
      ...config,
      thompsonPriors: updatedPriors,
      contextWeights: {
        personaWeights: contextWeightResult.personaWeights,
        frictionWeights: contextWeightResult.frictionWeights,
      },
    };
  }

  await prisma.brand.update({
    where: { id: brandId },
    data: {
      growthMemory: JSON.stringify(memory),
      ...(updatedWeights && { formulaWeights: JSON.stringify(updatedWeights) }),
      ...(updatedBrandConfig && { brandConfig: serializeBrandConfigUpdate(brand?.brandConfig, updatedBrandConfig) }),
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
    contextWeights: updatedBrandConfig?.contextWeights,
    promotedPersonas: contextWeightResult?.promotedPersonas ?? [],
    demotedPersonas: contextWeightResult?.demotedPersonas ?? [],
    promotedFrictions: contextWeightResult?.promotedFrictions ?? [],
    demotedFrictions: contextWeightResult?.demotedFrictions ?? [],
    ...buildGrowthReport(posts, memory),
  };
}

export const runGrowthFeedbackLoop = learnBrandGrowth;
