import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { accessErrorResponse, requireBrandForCurrentUser } from "@/lib/brand-access";
import { parseBrandConfig, serializeBrandConfigUpdate } from "@/types/brand";
import type { AccountHealthState } from "@/types/brand";
import {
  evaluateShadowbanHealth,
  getSelfHealingAction,
  type PostReachRecord,
} from "@/lib/shadowban-health-probe";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { brand } = await requireBrandForCurrentUser(id);

    const config = parseBrandConfig(brand.brandConfig);

    return NextResponse.json({
      success: true,
      brandId: brand.id,
      brandSlug: brand.slug,
      accountHealth: config.accountHealth || {
        status: config.shadowbanStatus || "HEALTHY",
        trustTier: config.accountTrustTier || "established",
        publishedTodayCount: 0,
        lastPublishDate: new Date().toISOString().slice(0, 10),
        lastEvaluatedAt: new Date().toISOString(),
        metrics: {
          recentAverageViews: 0,
          baselineAverageViews: 0,
          dropPercentage: 0,
          consecutiveDepressedCount: 0,
        },
        reasons: ["기본 정상 상태"],
        healingDirective: {
          mode: "NORMAL",
          freezePolarizingFormulas: false,
          maxDailyPosts: 5,
          forbiddenElements: [],
          actionMessage: "정상 상태",
        },
      },
    });
  } catch (error) {
    const accessResponse = accessErrorResponse(error);
    if (accessResponse) return accessResponse;
    const message = error instanceof Error ? error.message : "조회 실패";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { brand } = await requireBrandForCurrentUser(id);
    const body = (await request.json()) as {
      status?: "HEALTHY" | "WARNING" | "SHADOWBAN_SUSPECTED" | "RECOVERY";
      reason?: string;
    };

    if (!body.status) {
      return NextResponse.json({ error: "status is required" }, { status: 400 });
    }

    const config = parseBrandConfig(brand.brandConfig);
    const prevHealth = config.accountHealth;

    const isShadowban = body.status === "SHADOWBAN_SUSPECTED";
    const mode = isShadowban ? "WARMUP_ONLY" : body.status === "WARNING" ? "MONITOR" : "NORMAL";

    const updatedHealth: AccountHealthState = {
      status: body.status,
      trustTier: config.accountTrustTier || "established",
      publishedTodayCount: prevHealth?.publishedTodayCount ?? 0,
      lastPublishDate: prevHealth?.lastPublishDate ?? new Date().toISOString().slice(0, 10),
      lastEvaluatedAt: new Date().toISOString(),
      metrics: prevHealth?.metrics ?? {
        recentAverageViews: 0,
        baselineAverageViews: 0,
        dropPercentage: 0,
        consecutiveDepressedCount: 0,
      },
      reasons: [body.reason || `운영자 수동 오버라이드 (${body.status})`],
      healingDirective: {
        mode,
        freezePolarizingFormulas: isShadowban,
        maxDailyPosts: isShadowban ? 1 : 5,
        forbiddenElements: isShadowban ? ["link", "offer_cta", "aggressive_hook"] : [],
        actionMessage: isShadowban
          ? "운영자에 의해 섀도우밴 자율 치유 모드로 강제 전환되었습니다."
          : "운영자에 의해 정상 모드로 복구되었습니다.",
      },
    };

    config.accountHealth = updatedHealth;
    config.shadowbanStatus = body.status === "RECOVERY" ? "WARNING" : body.status;

    await prisma.brand.update({
      where: { id: brand.id },
      data: {
        brandConfig: serializeBrandConfigUpdate(brand.brandConfig, config),
      },
    });

    return NextResponse.json({
      success: true,
      brandId: brand.id,
      accountHealth: updatedHealth,
    });
  } catch (error) {
    const accessResponse = accessErrorResponse(error);
    if (accessResponse) return accessResponse;
    const message = error instanceof Error ? error.message : "업데이트 실패";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { brand } = await requireBrandForCurrentUser(id);

    let force = false;
    try {
      const url = new URL(_request.url);
      if (url.searchParams.get("force") === "true") {
        force = true;
      } else {
        const body = await _request.clone().json().catch(() => ({}));
        if (body && body.force === true) {
          force = true;
        }
      }
    } catch {
      // ignore
    }

    const config = parseBrandConfig(brand.brandConfig);
    const existingHealth = config.accountHealth;

    // 1-minute debounce check to protect against evaluation spam
    if (!force && existingHealth?.lastEvaluatedAt) {
      const elapsedMs = Date.now() - new Date(existingHealth.lastEvaluatedAt).getTime();
      if (elapsedMs >= 0 && elapsedMs < 60000) {
        return NextResponse.json({
          success: true,
          brandId: brand.id,
          accountHealth: existingHealth,
          cached: true,
        });
      }
    }

    // Fetch published posts with reach metrics
    const posts = await prisma.post.findMany({
      where: {
        brandId: brand.id,
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
        views: p.views ?? 0,
        likes: p.likes ?? 0,
        replies: p.replies ?? 0,
        publishedAt: p.publishedAt as Date,
      }));

    const report = evaluateShadowbanHealth(history, {
      minHoursSincePublished: 6,
      minTotalPostsForColdStart: 5,
    });

    const directive = getSelfHealingAction(report);

    const updatedHealth: AccountHealthState = {
      status: report.status,
      trustTier: config.accountTrustTier || "established",
      publishedTodayCount: config.accountHealth?.publishedTodayCount ?? 0,
      lastPublishDate: new Date().toISOString().slice(0, 10),
      lastEvaluatedAt: new Date().toISOString(),
      metrics: {
        recentAverageViews: report.recentAverageViews,
        baselineAverageViews: report.baselineAverageViews,
        dropPercentage: report.dropPercentage,
        consecutiveDepressedCount: report.consecutiveDepressedCount,
      },
      reasons: report.reasons,
      healingDirective: directive,
    };

    config.accountHealth = updatedHealth;
    config.shadowbanStatus = report.status;

    await prisma.brand.update({
      where: { id: brand.id },
      data: {
        brandConfig: serializeBrandConfigUpdate(brand.brandConfig, config),
      },
    });

    return NextResponse.json({
      success: true,
      brandId: brand.id,
      report,
      accountHealth: updatedHealth,
    });
  } catch (error) {
    const accessResponse = accessErrorResponse(error);
    if (accessResponse) return accessResponse;
    const message = error instanceof Error ? error.message : "재평가 실패";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
