import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { accessErrorResponse, requireBrandForCurrentUser } from "@/lib/brand-access";
import { getFreshBrandCredentials, publishReplyWithRetryForBrand } from "@/lib/threads-api";
import { fetchRepliesForPost, generateDraftReply, type ThreadsReplyItem } from "@/lib/threads-replies";

export const maxDuration = 15;

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const brandId = searchParams.get("brandId");
  if (!brandId) {
    return NextResponse.json({ error: "brandId is required" }, { status: 400 });
  }

  try {
    const { brand } = await requireBrandForCurrentUser(brandId);
    const credentials = await getFreshBrandCredentials(brand.id);

    // Fetch the 5 most recent published posts that have a threadsId
    const publishedPosts = await prisma.post.findMany({
      where: {
        brandId: brand.id,
        status: "PUBLISHED",
        threadsId: { not: null },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        content: true,
        threadsId: true,
        createdAt: true,
      },
    });

    const results: Array<{
      postId: string;
      postContent: string;
      threadsId: string;
      replies: ThreadsReplyItem[];
    }> = [];

    for (const post of publishedPosts) {
      if (!post.threadsId) continue;
      const rawReplies = await fetchRepliesForPost(post.threadsId, credentials.accessToken);

      // Generate AI draft for each reply
      const repliesWithDrafts: ThreadsReplyItem[] = [];
      for (const reply of rawReplies.slice(0, 5)) {
        const draft = await generateDraftReply(post.content, reply.text, brand.name);
        repliesWithDrafts.push({
          ...reply,
          draftReply: draft,
        });
      }

      results.push({
        postId: post.id,
        postContent: post.content,
        threadsId: post.threadsId,
        replies: repliesWithDrafts,
      });
    }

    return NextResponse.json({ success: true, posts: results });
  } catch (error) {
    const accessResponse = accessErrorResponse(error);
    if (accessResponse) return accessResponse;

    console.error("GET /api/interactions error:", error);
    return NextResponse.json({ success: false, error: "댓글을 불러오지 못했습니다.", posts: [] }, { status: 500 });
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { brandId, replyToThreadsId, replyText } = body;

    if (!brandId || !replyToThreadsId || !replyText?.trim()) {
      return NextResponse.json(
        { error: "brandId, replyToThreadsId, and replyText are required" },
        { status: 400 }
      );
    }

    const { brand } = await requireBrandForCurrentUser(brandId);
    const credentials = await getFreshBrandCredentials(brand.id);

    const publishedReplyId = await publishReplyWithRetryForBrand(
      replyText.trim(),
      replyToThreadsId,
      credentials
    );

    return NextResponse.json({
      success: true,
      publishedReplyId,
    });
  } catch (error) {
    const accessResponse = accessErrorResponse(error);
    if (accessResponse) return accessResponse;

    console.error("POST /api/interactions error:", error);
    const message = error instanceof Error ? error.message : "답글 발행 실패";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
