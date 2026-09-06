import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calculatePerformanceScore, getPerformanceTier } from "@/lib/growth-learning";
import { learnBrandGrowth } from "@/lib/growth-service";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      secret,
      postId,
      pid,
      eventType = "click",
      amount = 0,
      sessionId,
      idempotencyKey,
    } = body;

    const targetPostId = postId || pid;
    if (!targetPostId) {
      return NextResponse.json({ error: "Missing postId or pid parameter" }, { status: 400 });
    }

    // Strict Webhook Secret Validation
    const webhookSecret = process.env.CONVERSION_WEBHOOK_SECRET || process.env.CRON_SECRET;
    if (webhookSecret) {
      const providedSecret =
        secret ||
        request.headers.get("x-webhook-secret") ||
        request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

      if (!providedSecret || providedSecret !== webhookSecret) {
        return NextResponse.json({ error: "Unauthorized webhook secret" }, { status: 401 });
      }
    }

    const post = await prisma.post.findUnique({
      where: { id: targetPostId },
    });

    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    // Event type normalization
    const rawEvent = String(eventType || "click").toLowerCase();
    let normalizedEvent: "click" | "conversion" | "paid_conversion" = "click";
    let clickIncrement = 0;
    let conversionIncrement = 0;
    let paidIncrement = 0;

    if (rawEvent === "click" || rawEvent === "landing_view") {
      normalizedEvent = "click";
      clickIncrement = 1;
    } else if (
      rawEvent === "test_start" ||
      rawEvent === "first_result_view" ||
      rawEvent === "conversion" ||
      rawEvent === "analysis_start" ||
      rawEvent === "ritual_action_viewed"
    ) {
      normalizedEvent = "conversion";
      conversionIncrement = 1;
    } else if (
      rawEvent === "paid_conversion" ||
      rawEvent === "checkout_success" ||
      rawEvent === "payment" ||
      rawEvent === "order_complete"
    ) {
      normalizedEvent = "paid_conversion";
      paidIncrement = 1;
    }

    // Durable DB Idempotency & Deduplication Check
    const dedupeIdentifier = idempotencyKey || sessionId;
    const dedupeKey = dedupeIdentifier ? `${dedupeIdentifier}:${normalizedEvent}:${targetPostId}` : null;

    if (dedupeKey) {
      const existingEvent = await prisma.conversionEvent.findUnique({
        where: { idempotencyKey: dedupeKey },
      });

      if (existingEvent) {
        return NextResponse.json({
          success: true,
          deduped: true,
          eventType: normalizedEvent,
          amount,
          post: {
            id: post.id,
            formulaId: post.formulaId,
            clicks: post.clicks,
            conversions: post.conversions,
            manualPaidConversions: post.manualPaidConversions,
            performanceScore: post.performanceScore,
            performanceTier: post.performanceTier,
          },
        });
      }
    }

    const updatedClicks = (post.clicks ?? 0) + clickIncrement;
    const updatedConversions = (post.conversions ?? 0) + conversionIncrement;
    const updatedPaidConversions = (post.manualPaidConversions ?? 0) + paidIncrement;

    const newScore = calculatePerformanceScore({
      views: post.views,
      likes: post.likes,
      replies: post.replies,
      reposts: post.reposts,
      clicks: updatedClicks,
      conversions: updatedConversions,
      manualPaidConversions: updatedPaidConversions,
    });

    let updatedPost;
    try {
      if (dedupeKey) {
        await prisma.conversionEvent.create({
          data: {
            brandId: post.brandId || "unknown",
            postId: post.id,
            idempotencyKey: dedupeKey,
            eventType: normalizedEvent,
            amount: typeof amount === "number" ? amount : 0,
            sessionId: typeof sessionId === "string" ? sessionId : null,
            metadata: JSON.stringify({ sessionId, rawEvent }),
          },
        });
      }

      updatedPost = await prisma.post.update({
        where: { id: targetPostId },
        data: {
          clicks: updatedClicks,
          conversions: updatedConversions,
          manualPaidConversions: updatedPaidConversions,
          performanceScore: newScore,
          performanceTier: getPerformanceTier(newScore),
          metricsAt: new Date(),
        },
        select: {
          id: true,
          formulaId: true,
          clicks: true,
          conversions: true,
          manualPaidConversions: true,
          performanceScore: true,
          performanceTier: true,
        },
      });
    } catch (txError: any) {
      if (txError?.code === "P2002") {
        return NextResponse.json({
          success: true,
          deduped: true,
          eventType: normalizedEvent,
          amount,
          post: {
            id: post.id,
            formulaId: post.formulaId,
            clicks: post.clicks,
            conversions: post.conversions,
            manualPaidConversions: post.manualPaidConversions,
            performanceScore: post.performanceScore,
            performanceTier: post.performanceTier,
          },
        });
      }
      throw txError;
    }

    // Event-driven immediate learning: trigger adaptive growth update in background for conversions
    if (post.brandId && (normalizedEvent === "paid_conversion" || normalizedEvent === "conversion")) {
      void learnBrandGrowth(post.brandId).catch((err) =>
        console.error("[conversion-webhook] Background learning failed:", err)
      );
    }

    return NextResponse.json({
      success: true,
      deduped: false,
      eventType: normalizedEvent,
      amount,
      post: updatedPost,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}
