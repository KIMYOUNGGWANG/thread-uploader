import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { publishPost, publishReply, initializeTokensInDB } from "@/lib/threads-api";

interface RouteParams {
    params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
    let postId: string | null = null;
    try {
        await initializeTokensInDB();

        const { id } = await params;
        postId = id;

        const post = await prisma.post.findUnique({
            where: { id },
        });

        if (!post) {
            return NextResponse.json(
                { error: "Post not found" },
                { status: 404 }
            );
        }

        if (post.status === "PUBLISHED" || post.threadsId) {
            return NextResponse.json(
                { error: "Post is already published" },
                { status: 400 }
            );
        }

        // DB imageUrls is stored as a JSON string
        const imageUrls = JSON.parse(post.imageUrls || "[]");

        // Publish to Threads
        const threadsId = await publishPost(post.content, imageUrls);

        // 첫 댓글이 예약되어 있으면 쏜다
        if (post.firstComment) {
            try {
                // API 속도/안정화 대기
                await new Promise(r => setTimeout(r, 4000));
                await publishReply(post.firstComment, threadsId);
            } catch (replyError) {
                console.error("Failed to post first comment:", replyError);
                // 첫 댓글 실패해도 포스트 자체는 성공으로 가야 함
            }
        }

        // Update post status
        const updatedPost = await prisma.post.update({
            where: { id },
            data: {
                status: "PUBLISHED",
                threadsId,
                errorLog: null,
            },
        });

        return NextResponse.json({
            success: true,
            threadsId,
            post: updatedPost,
            message: "Posted to Threads successfully!",
        });
    } catch (error) {
        console.error("Publish error:", error);

        // Try to update post status to FAILED
        if (postId) {
            try {
                await prisma.post.update({
                    where: { id: postId },
                    data: {
                        status: "FAILED",
                        errorLog: error instanceof Error ? error.message : "Failed to publish",
                    },
                });
            } catch (dbError) {
                console.error("Failed to update post status to FAILED:", dbError);
            }
        }

        return NextResponse.json(
            {
                error: error instanceof Error ? error.message : "Failed to publish to Threads",
            },
            { status: 500 }
        );
    }
}
