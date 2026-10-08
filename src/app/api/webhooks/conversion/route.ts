import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { safeEqual } from "@/lib/cron-auth";
import { calculatePerformanceScore, getPerformanceTier } from "@/lib/growth-learning";
import { learnBrandGrowth } from "@/lib/growth-service";

type NormalizedEvent = "click" | "conversion" | "paid_conversion";

const CLICK_EVENTS = new Set(["click", "landing_view"]);
const CONVERSION_EVENTS = new Set(["test_start", "first_result_view", "conversion", "analysis_start", "decision_question_submit", "ritual_action_viewed"]);
const PAID_EVENTS = new Set(["paid_conversion", "checkout_success", "payment", "order_complete"]);

const POST_SUMMARY_SELECT = {
  id: true,
  formulaId: true,
  clicks: true,
  conversions: true,
  manualPaidConversions: true,
  performanceScore: true,
  performanceTier: true,
} as const;

function normalizeEvent(eventType: unknown): NormalizedEvent | null {
  const raw = String(eventType || "click").toLowerCase();
  if (PAID_EVENTS.has(raw)) return "paid_conversion";
  if (CONVERSION_EVENTS.has(raw)) return "conversion";
  if (CLICK_EVENTS.has(raw)) return "click";
  return null;
}

// Browser events (click/conversion) are public. Paid events must come from a server
// holding CONVERSION_WEBHOOK_SECRET, sent in a header — never from landing-page JS.
function isPaidEventAuthorized(request: NextRequest): boolean {
  const webhookSecret = process.env.CONVERSION_WEBHOOK_SECRET;
  if (!webhookSecret) return false;
  const provided =
    request.headers.get("x-webhook-secret") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    "";
  return safeEqual(provided, webhookSecret);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { postId, pid, eventType, amount = 0, sessionId, idempotencyKey } = body;

    const targetPostId = postId || pid;
    if (!targetPostId || typeof targetPostId !== "string") {
      return NextResponse.json({ error: "Missing postId or pid parameter" }, { status: 400 });
    }

    const normalizedEvent = normalizeEvent(eventType);
    if (!normalizedEvent) {
      return NextResponse.json({ success: true, ignored: true, eventType });
    }
    if (normalizedEvent === "paid_conversion" && !isPaidEventAuthorized(request)) {
      return NextResponse.json({ error: "Unauthorized webhook secret" }, { status: 401 });
    }

    const post = await prisma.post.findUnique({ where: { id: targetPostId }, select: { ...POST_SUMMARY_SELECT, brandId: true } });
    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    const dedupeIdentifier = idempotencyKey || sessionId;
    const dedupeKey = dedupeIdentifier ? `${dedupeIdentifier}:${normalizedEvent}:${targetPostId}` : null;
    const { brandId, ...postSummary } = post;
    const dedupedResponse = () =>
      NextResponse.json({ success: true, deduped: true, eventType: normalizedEvent, amount, post: postSummary });

    if (dedupeKey && (await prisma.conversionEvent.findUnique({ where: { idempotencyKey: dedupeKey } }))) {
      return dedupedResponse();
    }

    let updatedPost;
    try {
      updatedPost = await recordEvent({ postId: targetPostId, brandId, normalizedEvent, dedupeKey, amount, sessionId });
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return dedupedResponse();
      }
      throw error;
    }

    if (brandId && normalizedEvent !== "click") {
      void learnBrandGrowth(brandId).catch((err) =>
        console.error("[conversion-webhook] Background learning failed:", err)
      );
    }

    return NextResponse.json({ success: true, deduped: false, eventType: normalizedEvent, amount, post: updatedPost });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}

interface RecordEventInput {
  postId: string;
  brandId: string | null;
  normalizedEvent: NormalizedEvent;
  dedupeKey: string | null;
  amount: unknown;
  sessionId: unknown;
}

// Event insert + atomic counter increment + score refresh in one transaction,
// so concurrent events never overwrite each other's counts.
async function recordEvent(input: RecordEventInput) {
  const click = input.normalizedEvent === "click" ? 1 : 0;
  const conversion = input.normalizedEvent === "conversion" ? 1 : 0;
  const paid = input.normalizedEvent === "paid_conversion" ? 1 : 0;

  return prisma.$transaction(async (tx) => {
    if (input.dedupeKey) {
      await tx.conversionEvent.create({
        data: {
          brandId: input.brandId || "unknown",
          postId: input.postId,
          idempotencyKey: input.dedupeKey,
          eventType: input.normalizedEvent,
          amount: typeof input.amount === "number" ? input.amount : 0,
          sessionId: typeof input.sessionId === "string" ? input.sessionId : null,
          metadata: JSON.stringify({ sessionId: input.sessionId }),
        },
      });
    }

    await tx.$executeRaw`
      UPDATE "Post" SET
        "clicks" = COALESCE("clicks", 0) + ${click},
        "conversions" = COALESCE("conversions", 0) + ${conversion},
        "manualPaidConversions" = COALESCE("manualPaidConversions", 0) + ${paid},
        "metricsAt" = NOW()
      WHERE "id" = ${input.postId}`;

    const counted = await tx.post.findUniqueOrThrow({ where: { id: input.postId } });
    const score = calculatePerformanceScore(counted);
    return tx.post.update({
      where: { id: input.postId },
      data: { performanceScore: score, performanceTier: getPerformanceTier(score) },
      select: POST_SUMMARY_SELECT,
    });
  });
}
