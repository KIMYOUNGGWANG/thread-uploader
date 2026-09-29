import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { accessErrorResponse, requirePostForCurrentUser } from "@/lib/brand-access";
import { remediatePostAlgorithmic } from "@/lib/remediation-engine";
import { parseBrandConfig } from "@/types/brand";

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
      },
      targetThreshold
    );

    const nextStatus = remediation.pass ? "PENDING" : "NEEDS_REVIEW";

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
        status: nextStatus,
        qualityPass: remediation.pass ? true : post.qualityPass,
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
        pass: remediation.pass,
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
