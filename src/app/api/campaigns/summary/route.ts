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

function todayActivityWhere() {
  const start = startOfToday();
  const end = startOfTomorrow();
  return {
    OR: [
      { scheduledAt: { gte: start, lt: end } },
      { createdAt: { gte: start, lt: end } },
      { publishedAt: { gte: start, lt: end } },
    ],
  };
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

export interface SummaryMetricPost {
  views: number | null;
  replies: number | null;
  reposts: number | null;
  clicks: number | null;
  conversions: number | null;
  manualPaidConversions: number | null;
  qualityPass: boolean | null;
}

export function sumMetricValue(posts: SummaryMetricPost[], metricName: string): number {
  const normalized = metricName.trim();
  if (normalized === "views") return posts.reduce((sum, post) => sum + (post.views ?? 0), 0);
  if (normalized === "replies") return posts.reduce((sum, post) => sum + (post.replies ?? 0), 0);
  if (normalized === "reposts") return posts.reduce((sum, post) => sum + (post.reposts ?? 0), 0);
  if (normalized === "clicks") return posts.reduce((sum, post) => sum + (post.clicks ?? 0), 0);
  if (normalized === "conversions") return posts.reduce((sum, post) => sum + (post.conversions ?? 0), 0);
  if (normalized === "manualPaidConversions") return posts.reduce((sum, post) => sum + (post.manualPaidConversions ?? 0), 0);
  return 0;
}

export function buildCampaignNextAction(posts: SummaryMetricPost[], primaryMetric: string, conversionMetric: string): string {
  if (posts.length === 0) return "첫 배치를 생성하고 제품 가설에 맞는 hook/CTA를 넓게 테스트하세요.";
  const qualityFailed = posts.filter((post) => post.qualityPass === false).length;
  if (qualityFailed / posts.length >= 0.3) return "품질 실패 비율이 높습니다. 제품 키워드와 CTA를 더 명확히 넣어 재생성하세요.";
  if (sumMetricValue(posts, conversionMetric) > 0) return "전환 신호가 있습니다. 같은 오퍼 약속을 유지하고 hook만 변주하세요.";
  if (sumMetricValue(posts, primaryMetric) === 0) return "핵심 지표가 아직 비어 있습니다. 게시 후 수동 성과를 먼저 입력하세요.";
  return "성과가 있는 주제 1개를 고르고 다음 배치에서 CTA만 바꿔 비교하세요.";
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
        ...todayActivityWhere(),
      },
      orderBy: [{ publishedAt: "asc" }, { createdAt: "asc" }, { scheduledAt: "asc" }],
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
    const primaryMetricName = config.activeExperiment.primaryMetric || config.productProfile.primaryMetric;
    const conversionMetricName = config.productProfile.conversionMetric;
    const primaryMetricValue = sumMetricValue(posts, primaryMetricName);
    const conversionMetricValue = sumMetricValue(posts, conversionMetricName);

    return NextResponse.json({
      brandId,
      campaignId: campaign.id,
      campaign,
      productProfile: config.productProfile,
      activeExperiment: config.activeExperiment,
      primaryMetric: {
        name: primaryMetricName,
        value: primaryMetricValue,
      },
      conversionMetric: {
        name: conversionMetricName,
        value: conversionMetricValue,
      },
      evidenceState: posts.length === 0 ? "learning" : "measuring",
      nextAction: buildCampaignNextAction(posts, primaryMetricName, conversionMetricName),
      todayScheduled: posts.map((post) => ({
        id: post.id,
        content: post.content,
        scheduledAt: post.scheduledAt,
        publishedAt: post.publishedAt,
        createdAt: post.createdAt,
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
