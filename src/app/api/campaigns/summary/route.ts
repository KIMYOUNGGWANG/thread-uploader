import { NextRequest, NextResponse } from "next/server";
import { accessErrorResponse, requireBrandForCurrentUser } from "@/lib/brand-access";
import { calculatePerformanceScore, getPerformanceTier } from "@/lib/growth-learning";
import { prisma } from "@/lib/prisma";
import { getActiveCampaign, parseBrandConfig } from "@/types/brand";

function startOfToday(): Date {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function startOfTomorrow(): Date {
  const date = startOfToday();
  date.setDate(date.getDate() + 1);
  return date;
}

function parseQualityReasons(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((value): value is string => typeof value === "string")
      : [];
  } catch {
    return [];
  }
}

export async function GET(request: NextRequest) {
  try {
    const brandId = request.nextUrl.searchParams.get("brandId");
    const requestedCampaignId = request.nextUrl.searchParams.get("campaignId");
    if (!brandId) {
      return NextResponse.json({ error: "brandId is required" }, { status: 400 });
    }

    const { brand } = await requireBrandForCurrentUser(brandId);
    const config = parseBrandConfig(brand.brandConfig);
    const campaign = getActiveCampaign(config, requestedCampaignId);
    if (!campaign) {
      return NextResponse.json({ error: "campaign not found" }, { status: 404 });
    }

    const posts = await prisma.post.findMany({
      where: {
        brandId,
        campaignId: campaign.id,
        scheduledAt: {
          gte: startOfToday(),
          lt: startOfTomorrow(),
        },
      },
      orderBy: { scheduledAt: "asc" },
    });

    const linked = posts.filter((post) => Boolean(post.linkUrl)).length;
    const qualityPassed = posts.filter((post) => post.qualityPass === true).length;
    const qualityFailed = posts.filter((post) => post.qualityPass === false).length;
    const totalViews = posts.reduce((sum, post) => sum + (post.views ?? 0), 0);
    const totalReplies = posts.reduce((sum, post) => sum + (post.replies ?? 0), 0);
    const totalReposts = posts.reduce((sum, post) => sum + (post.reposts ?? 0), 0);
    const totalClicks = posts.reduce((sum, post) => sum + (post.clicks ?? 0), 0);
    const totalConversions = posts.reduce((sum, post) => sum + (post.conversions ?? 0), 0);
    const totalManualPaidConversions = posts.reduce((sum, post) => sum + (post.manualPaidConversions ?? 0), 0);

    return NextResponse.json({
      campaign,
      todayScheduled: posts.map((post) => ({
        id: post.id,
        content: post.content,
        scheduledAt: post.scheduledAt,
        status: post.status,
        firstComment: post.firstComment,
        linkUrl: post.linkUrl,
        utmContent: post.utmContent,
        qualityProfile: post.qualityProfile,
        qualityPass: post.qualityPass,
        qualityReasons: parseQualityReasons(post.qualityReasons),
        campaignFormulaId: post.campaignFormulaId,
        careerDecisionType: post.careerDecisionType,
        views: post.views ?? 0,
        replies: post.replies ?? 0,
        reposts: post.reposts ?? 0,
        clicks: post.clicks ?? 0,
        conversions: post.conversions ?? 0,
        manualPaidConversions: post.manualPaidConversions ?? 0,
        performanceScore: post.performanceScore ?? calculatePerformanceScore(post),
        performanceTier: post.performanceTier ?? getPerformanceTier(calculatePerformanceScore(post)),
      })),
      linkRatio: {
        linked,
        total: posts.length,
        percent: posts.length ? Math.round((linked / posts.length) * 100) : 0,
      },
      quality: {
        passed: qualityPassed,
        failed: qualityFailed,
        unknown: posts.length - qualityPassed - qualityFailed,
        total: posts.length,
      },
      metrics: {
        views: totalViews,
        replies: totalReplies,
        reposts: totalReposts,
        clicks: totalClicks,
        conversions: totalConversions,
        manualPaidConversions: totalManualPaidConversions,
      },
      scoreWeights: {
        replies: 40,
        reposts: 25,
        views: 20,
        clicksConversions: 15,
      },
      replyPlaybook: campaign.replyPlaybook,
    });
  } catch (error) {
    const response = accessErrorResponse(error);
    if (response) return response;
    console.error("Error fetching campaign summary:", error);
    return NextResponse.json({ error: "Failed to fetch campaign summary" }, { status: 500 });
  }
}
