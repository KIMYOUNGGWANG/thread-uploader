import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyCronSecret } from "@/lib/cron-auth";
import { evaluate72hFeedbackLoop, type MaturePostMetric } from "@/lib/campaign-feedback-loop";
import { mergeNegativePhrasesIntoBrandConfig } from "@/lib/trend-radar/negative-pattern-learner";

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const brandSlug = searchParams.get("brandSlug");
  const shouldApply = searchParams.get("apply") === "true";

  const brandFilter = brandSlug ? { slug: brandSlug } : {};
  const brands = await prisma.brand.findMany({
    where: brandFilter,
    select: { id: true, slug: true, name: true, formulaWeights: true, viralMemory: true, brandConfig: true },
  });

  if (brands.length === 0) {
    return NextResponse.json({ reports: [], message: "No matching brands found" });
  }

  const reports = [];

  for (const brand of brands) {
    const posts = await prisma.post.findMany({
      where: {
        brandId: brand.id,
        status: "PUBLISHED",
        publishedAt: { not: null },
      },
      select: {
        id: true,
        content: true,
        campaignFormulaId: true,
        publishedAt: true,
        metricsAt: true,
        views: true,
        replies: true,
        reposts: true,
        conversions: true,
      },
      orderBy: { publishedAt: "desc" },
      take: 200,
    });

    const report = evaluate72hFeedbackLoop(posts as MaturePostMetric[], {
      brandId: brand.id,
      now: new Date(),
    });

    let applied = false;
    if (shouldApply && Object.keys(report.recommendedWeights).length > 0) {
      // 1. Update formula weights
      let currentWeights: Record<string, number> = {};
      try {
        currentWeights = JSON.parse(brand.formulaWeights || "{}");
      } catch {
        currentWeights = {};
      }

      const mergedWeights = { ...currentWeights, ...report.recommendedWeights };

      // 2. Update top performers into viral memory
      let currentViralMemory: Record<string, unknown> = {};
      try {
        const parsedMemory: unknown = JSON.parse(brand.viralMemory || "{}");
        currentViralMemory = typeof parsedMemory === "object" && parsedMemory !== null
          ? (parsedMemory as Record<string, unknown>)
          : {};
      } catch {
        currentViralMemory = {};
      }

      const updatedViralMemory = {
        ...currentViralMemory,
        lastHarvestAt: new Date().toISOString(),
        topPerformers: report.topPerformers.map((tp) => ({
          postId: tp.id,
          hook: tp.hook,
          score: tp.score,
          views: tp.views,
        })),
      };

      // 3. Update negative failure patterns into brandConfig prohibitedPhrases
      let currentBrandConfig: Record<string, unknown> = {};
      try {
        const parsedConfig: unknown = JSON.parse(brand.brandConfig || "{}");
        currentBrandConfig = typeof parsedConfig === "object" && parsedConfig !== null
          ? (parsedConfig as Record<string, unknown>)
          : {};
      } catch {
        currentBrandConfig = {};
      }
      const updatedBrandConfig = mergeNegativePhrasesIntoBrandConfig(
        currentBrandConfig,
        report.negativeClichesLearned || []
      );

      await prisma.brand.update({
        where: { id: brand.id },
        data: {
          formulaWeights: JSON.stringify(mergedWeights),
          viralMemory: JSON.stringify(updatedViralMemory),
          brandConfig: JSON.stringify(updatedBrandConfig),
        },
      });

      applied = true;
    }

    reports.push({
      brandSlug: brand.slug,
      brandName: brand.name,
      applied,
      report,
    });
  }

  return NextResponse.json({ success: true, reports });
}
