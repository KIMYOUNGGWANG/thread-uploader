import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getFreshBrandCredentials } from "@/lib/threads-api";
import { publishOrResumePost } from "@/lib/threads/thread-resume-engine";
import { accessErrorResponse, requirePostForCurrentUser } from "@/lib/brand-access";
import { getPublishSafetyBlockReasons } from "@/lib/publish-safety-gate";

export const maxDuration = 300; // video containers can take minutes to process

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const postId: string = id;

  try {
    const { post, brand } = await requirePostForCurrentUser(id);
    const isFullyPublished = post.status === "PUBLISHED" && post.threadsId && (post.threadPartsPosted === post.threadTotalParts || post.threadTotalParts <= 1);
    if (isFullyPublished) {
      return NextResponse.json({ error: "Post is already published" }, { status: 400 });
    }
    const safetyReasons = getPublishSafetyBlockReasons(post);
    if (safetyReasons.length > 0) {
      await prisma.post.update({
        where: { id },
        data: {
          qualityPass: false,
          qualityReasons: JSON.stringify(safetyReasons),
        },
      });
      return NextResponse.json({
        error: "Safety gate failed. 수정하거나 다시 생성한 뒤 업로드하세요.",
        reasons: safetyReasons,
      }, { status: 400 });
    }

    const credentials = await getFreshBrandCredentials(brand.id);

    const result = await publishOrResumePost(post.id, credentials);

    if (!result.success || !result.rootThreadsId) {
      return NextResponse.json({
        error: result.error || "Publishing failed",
        partsPosted: result.partsPosted,
        totalParts: result.totalParts,
      }, { status: 500 });
    }

    const updatedPost = await prisma.post.findUnique({ where: { id } });

    return NextResponse.json({
      success: true,
      threadsId: result.rootThreadsId,
      replyError: result.error,
      post: updatedPost,
      partsPosted: result.partsPosted,
      totalParts: result.totalParts,
      isResumed: result.isResumed,
      message: result.error ? "본문 업로드 성공, 일부 댓글 실패" : "Posted to Threads successfully!",
    });
  } catch (error) {
    const response = accessErrorResponse(error);
    if (response) return response;
    console.error("Publish error:", error);
    if (postId) {
      // Never overwrite a post another worker is publishing (or already published) — that burns the claim.
      await prisma.post.updateMany({
        where: { id: postId, status: { notIn: ["PUBLISHING", "PARTIAL_PUBLISHED", "PUBLISHED"] } },
        data: { status: "FAILED", errorLog: error instanceof Error ? error.message : "Failed to publish" },
      }).catch(console.error);
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to publish to Threads" },
      { status: 500 }
    );
  }
}
