import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calculatePerformanceScore, getPerformanceTier } from "@/lib/growth-learning";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      secret,
      postId,
      pid,
      eventType = "click",
      amount = 0,
    } = body;

    const targetPostId = postId || pid;
    if (!targetPostId) {
      return NextResponse.json({ error: "Missing postId or pid parameter" }, { status: 400 });
    }

    const webhookSecret = process.env.CONVERSION_WEBHOOK_SECRET || process.env.CRON_SECRET;
    if (webhookSecret && secret && secret !== webhookSecret) {
      return NextResponse.json({ error: "Unauthorized webhook secret" }, { status: 401 });
    }

    const post = await prisma.post.findUnique({
      where: { id: targetPostId },
    });

    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    let clickIncrement = 0;
    let conversionIncrement = 0;
    let paidIncrement = 0;

    if (eventType === "click") {
      clickIncrement = 1;
    } else if (eventType === "test_start" || eventType === "conversion") {
      conversionIncrement = 1;
    } else if (eventType === "paid_conversion" || eventType === "payment") {
      paidIncrement = 1;
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
      eventType,
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
