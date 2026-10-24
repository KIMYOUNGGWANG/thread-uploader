import { prisma } from "@/lib/prisma";
import {
  buildGrowthMemory,
  buildGrowthReport,
  calculatePerformanceScore,
  computeWeeklyLift,
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
  updateThompsonPriors,
  type FormulaPerformanceObservation,
} from "@/lib/thompson-sampling-router";
import { isNewYearModeId } from "@/lib/new-year/new-year-season";
import { MATURITY_HOURS } from "@/lib/weekly-scorecard";
import { calculateGoalReward, calculateLearningScore, medianViews, resolveOptimizationGoal } from "@/lib/optimization-goal";

export async function learnBrandGrowth(brandId: string) {
  const brand = await prisma.brand.findUnique({
    where: { id: brandId },
    select: { id: brandId ? true : undefined, formulaWeights: true, brandConfig: true },
  });

  const fetchedPosts = await prisma.post.findMany({
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

  // Score with current metrics before learning, so weights never use last run's stale scores
  const allScoredPosts = fetchedPosts.map((post) => ({ ...post, performanceScore: calculatePerformanceScore(post) }));
  // New Year posts are seasonally inflated, so no learner sees them (their score is still written back).
  const posts = allScoredPosts.filter((post) => !isNewYearModeId(post.formulaId));
  const config = parseBrandConfig(brand?.brandConfig ?? "{}");
  const goal = resolveOptimizationGoal(config);

  // Filter out promotional / subsidized campaigns from organic formula weights to prevent data poisoning
  const organicPosts = posts.filter(
    (post) => !post.campaignId || !post.campaignId.toLowerCase().includes("promo")
  );

  // Learning ranks by the brand's goal (reach = views); the stored performanceScore stays revenue-based for display.
  const learningPosts = (organicPosts.length > 0 ? organicPosts : posts)
    .map((post) => ({ ...post, performanceScore: calculateLearningScore(goal, post) }));
  const memory = buildGrowthMemory(learningPosts);

  let updatedWeights: Record<string, number> | undefined;
  let promotedFormulas: string[] = [];
  let demotedFormulas: string[] = [];
  let updatedBrandConfig: ReturnType<typeof parseBrandConfig> | undefined;
  let contextWeightResult: ContextWeightAdjustmentResult | undefined;

  if (brand) {
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

    // Rebuild from the default weight every run: the 300-post window is re-read daily,
    // so stacking ±1 on the stored value walked top formulas to the ceiling without new evidence.
    const weightResult = computeAdaptiveFormulaWeights({}, learningPosts, knownFormulaIds);
    updatedWeights = weightResult.updatedWeights;
    promotedFormulas = weightResult.promotedFormulas;
    demotedFormulas = weightResult.demotedFormulas;

    const domainKey = DOMAIN_MATRICES[config.qualityProfile] ? config.qualityProfile : "saju_viral";
    const matrix = DOMAIN_MATRICES[domainKey] ?? DOMAIN_MATRICES.saju_viral;

    contextWeightResult = computeAdaptiveContextWeights(
      config.contextWeights?.personaWeights ?? {},
      config.contextWeights?.frictionWeights ?? {},
      learningPosts,
      matrix.personas,
      matrix.frictions
    );

    // Posts younger than MATURITY_HOURS haven't collected their views yet and would be learned as failures.
    const matureBefore = Date.now() - MATURITY_HOURS * 60 * 60 * 1000;
    const observations: FormulaPerformanceObservation[] = learningPosts
      .filter((p) => Boolean(p.formulaId) && typeof p.views === "number")
      .filter((p) => p.publishedAt != null && p.publishedAt.getTime() <= matureBefore)
      .map((p) => ({
        formulaId: p.formulaId!,
        views: p.views ?? 0,
        likes: p.likes ?? 0,
        replies: p.replies ?? 0,
        reposts: p.reposts ?? 0,
        linkClicks: p.clicks ?? 0,
        conversions: p.conversions ?? 0,
        paidConversions: p.manualPaidConversions ?? 0,
      }));

    // Rebuild from neutral priors every run: the 300-post window already covers history,
    // so stacking on stored priors would re-count the same posts daily and freeze exploration.
    const rewardContext = { medianViews: medianViews(observations.map((observation) => observation.views)) };
    const updatedPriors = updateThompsonPriors({}, observations, {
      reward: (observation) => calculateGoalReward(goal, observation, rewardContext),
    });

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

  for (const post of allScoredPosts) {
    const { performanceScore } = post;
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
    weeklyLift: computeWeeklyLift(learningPosts, now),
    ...buildGrowthReport(posts, memory),
  };
}

export const runGrowthFeedbackLoop = learnBrandGrowth;
