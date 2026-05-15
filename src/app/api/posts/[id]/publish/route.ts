import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { publishPostWithCredentials, publishReplyWithRetryForBrand } from "@/lib/threads-api";
import { accessErrorResponse, requirePostForCurrentUser } from "@/lib/brand-access";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const postId: string = id;

  try {
    const { post, brand } = await requirePostForCurrentUser(id);
    if (post.status === "PUBLISHED" || post.threadsId) {
      return NextResponse.json({ error: "Post is already published" }, { status: 400 });
    }

    const credentials = { accessToken: brand.accessToken, userId: brand.threadsUserId };
    const imageUrls = JSON.parse(post.imageUrls || "[]") as string[];

    const threadsId = await publishPostWithCredentials(post.content, credentials, imageUrls);

    if (!threadsId || threadsId === "undefined") {
      throw new Error(`Invalid Threads ID received: ${threadsId}`);
    }

    let replyErrorMessage: string | null = null;
    if (post.firstComment) {
      try {
        await publishReplyWithRetryForBrand(post.firstComment, threadsId, credentials);
      } catch (replyError) {
        replyErrorMessage = replyError instanceof Error ? replyError.message : "Failed to publish first comment";
      }
    }

    const updatedPost = await prisma.post.update({
      where: { id },
      data: {
        status: "PUBLISHED",
        threadsId,
        publishedAt: new Date(),
        errorLog: replyErrorMessage ? `First comment failed: ${replyErrorMessage}` : null,
      },
    });

    return NextResponse.json({
      success: true,
      threadsId,
      replyError: replyErrorMessage,
      post: updatedPost,
      message: replyErrorMessage ? "본문 업로드 성공, 첫 댓글 실패" : "Posted to Threads successfully!",
    });
  } catch (error) {
    const response = accessErrorResponse(error);
    if (response) return response;
    console.error("Publish error:", error);
    if (postId) {
      await prisma.post.update({
        where: { id: postId },
        data: { status: "FAILED", errorLog: error instanceof Error ? error.message : "Failed to publish" },
      }).catch(console.error);
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to publish to Threads" },
      { status: 500 }
    );
  }
}
