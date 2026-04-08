import { NextRequest, NextResponse } from "next/server";
import { initializeTokensInDB, publishPost, publishReplyWithRetry } from "@/lib/threads-api";

/**
 * POST /api/posts/upload
 * 
 * Immediately upload a post to Threads
 */
export async function POST(request: NextRequest) {
    try {
        // Initialize tokens if not already done
        await initializeTokensInDB();

        const body = await request.json();
        const { content, imageUrls = [], firstComment } = body;

        if (!content || typeof content !== "string") {
            return NextResponse.json(
                { error: "Content is required" },
                { status: 400 }
            );
        }

        if (content.length > 500) {
            return NextResponse.json(
                { error: "Content exceeds 500 character limit" },
                { status: 400 }
            );
        }

        // 1. Publish Main Post
        const threadsId = await publishPost(content, imageUrls);

        // 2. Publish First Comment (Reply) if exists
        let replyId = null;
        let replyErrorMessage: string | null = null;
        if (firstComment && typeof firstComment === "string") {
            try {
                replyId = await publishReplyWithRetry(firstComment, threadsId);
            } catch (error) {
                console.error("Failed to post first comment:", error);
                replyErrorMessage =
                    error instanceof Error
                        ? error.message
                        : "Failed to publish first comment";
                // We don't fail the whole request if the reply fails, but we log it
            }
        }

        return NextResponse.json({
            success: true,
            threadsId,
            replyId,
            replyError: replyErrorMessage,
            message: replyErrorMessage
                ? "본문은 업로드됐지만 첫 댓글은 실패했습니다."
                : firstComment
                    ? "Posted to Threads with reply!"
                    : "Posted to Threads!",
        });
    } catch (error) {
        console.error("Upload error:", error);
        return NextResponse.json(
            {
                error: error instanceof Error ? error.message : "Failed to upload to Threads",
            },
            { status: 500 }
        );
    }
}
