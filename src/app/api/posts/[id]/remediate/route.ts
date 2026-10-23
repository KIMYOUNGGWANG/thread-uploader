import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { accessErrorResponse, requirePostForCurrentUser } from "@/lib/brand-access";
import { remediatePostAlgorithmic } from "@/lib/remediation-engine";
import { checkQuality } from "@/lib/quality-gate";
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
    const gate = checkQuality(remediation.content, narrowQualityProfile(post.qualityProfile, config.qualityProfile));
    const passed = remediation.pass && gate.pass;

    const updated = await prisma.post.update({
      where: { id: post.id },
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

    const message = error instanceof Error ? error.message : "Remediation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
