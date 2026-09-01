import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calculatePerformanceScore, getPerformanceTier } from "@/lib/growth-learning";

// In-memory sliding window cache for idempotency / deduplication
const seenEvents = new Map<string, number>();
const DEDUPE_TTL_MS = 60 * 60 * 1000; // 1 hour

function cleanExpiredDedupeEntries(now: number) {
  if (seenEvents.size > 5000) {
    for (const [key, timestamp] of seenEvents.entries()) {
      if (now - timestamp > DEDUPE_TTL_MS) {
        seenEvents.delete(key);
      }
    }
  }
}

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

    // Deduplication check
    const dedupeIdentifier = sessionId || idempotencyKey;
    const now = Date.now();
    cleanExpiredDedupeEntries(now);

    if (dedupeIdentifier) {
      const dedupeKey = `${dedupeIdentifier}:${normalizedEvent}:${targetPostId}`;
      const previousTimestamp = seenEvents.get(dedupeKey);
      if (previousTimestamp && now - previousTimestamp < DEDUPE_TTL_MS) {
        // Return existing post status without double incrementing
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
      seenEvents.set(dedupeKey, now);
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

    const updatedPost = await prisma.post.update({
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
