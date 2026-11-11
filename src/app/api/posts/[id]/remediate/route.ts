import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { accessErrorResponse, requirePostForCurrentUser } from "@/lib/brand-access";
import { remediatePostAlgorithmic } from "@/lib/remediation-engine";
import { checkQuality } from "@/lib/quality-gate";
import { judgeEnglishNaturalness } from "@/lib/english-naturalness";
import { REQUEUE_CONFLICT_MESSAGE, REQUEUEABLE_POST_STATUSES, isRecordNotFoundError, isRequeueable } from "@/lib/post-status";
import { parseBrandConfig, type QualityProfileId } from "@/types/brand";

const QUALITY_PROFILE_IDS: readonly string[] = ["saju_viral", "career_decision", "product_growth", "ecommerce_d2c", "saas_b2b"];

function narrowQualityProfile(input: unknown, fallback: QualityProfileId): QualityProfileId {
  const match = QUALITY_PROFILE_IDS.find((id) => id === input);
  return match ? (match as QualityProfileId) : fallback;
}

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { post, brand } = await requirePostForCurrentUser(id);
    // The rewrite below ends by queueing the post for the publish cron. On one that is already published or in
    // flight that would publish the rewritten text again, so refuse before spending an LLM rewrite on it.
    if (!isRequeueable(post.status)) {
      return NextResponse.json({ error: REQUEUE_CONFLICT_MESSAGE }, { status: 409 });
    }

    const config = parseBrandConfig(brand.brandConfig);
    const targetThreshold = config.minAlgorithmicScore ?? 80;

    const remediation = await remediatePostAlgorithmic(
      post.content,
      post.firstComment,
      {
        topic: post.topic ?? undefined,
        targetAudience: post.targetAudience ?? undefined,
        productProfile: config.productProfile ? JSON.stringify(config.productProfile) : undefined,
        formulaId: post.formulaId ?? undefined,
      },
      targetThreshold
    );

    // The score alone must not promote a post: publish cron trusts qualityPass, so run the content gate too.
    const qualityProfile = narrowQualityProfile(post.qualityProfile, config.qualityProfile);
    const gate = checkQuality(remediation.content, qualityProfile);
    // English rewrites also need the naturalness judge that generation applies; only asked once score and gate pass.
    const isEnglish = qualityProfile === "ecommerce_d2c" || !/[가-힣]/.test(remediation.content);
    const natural = remediation.pass && gate.pass && isEnglish
      ? (await judgeEnglishNaturalness(remediation.content)).natural
      : true;
    const passed = remediation.pass && gate.pass && natural;

    // The rewrite takes tens of seconds, long enough for the cron to claim the post meanwhile. The status filter makes
    // this write conditional (no match throws P2025) instead of overwriting a post that is now publishing.
    const updated = await prisma.post.update({
      where: { id: post.id, status: { in: REQUEUEABLE_POST_STATUSES } },
      data: {
        content: remediation.content,
        firstComment: remediation.firstComment,
        algorithmicScore: remediation.scoreResult.totalScore,
        algorithmicPass: remediation.pass,
        algorithmicDimensions: JSON.stringify(remediation.scoreResult.dimensions),
        algorithmicFixes: JSON.stringify(remediation.actionableFixes),
        rewriteCount: { increment: remediation.rewriteCount },
        status: passed ? "PENDING" : "NEEDS_REVIEW",
        qualityPass: passed ? true : post.qualityPass,
      },
    });

    return NextResponse.json({
      success: true,
      post: updated,
      beforeScore: post.algorithmicScore ?? 0,
      afterScore: remediation.scoreResult.totalScore,
      remediation: {
        previousScore: post.algorithmicScore ?? 0,
        newScore: remediation.scoreResult.totalScore,
        pass: passed,
        method: remediation.method,
        actionableFixes: remediation.actionableFixes,
      },
    });
  } catch (error) {
    const accessResponse = accessErrorResponse(error);
    if (accessResponse) return accessResponse;
    if (isRecordNotFoundError(error)) return NextResponse.json({ error: REQUEUE_CONFLICT_MESSAGE }, { status: 409 });

    const message = error instanceof Error ? error.message : "Remediation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
