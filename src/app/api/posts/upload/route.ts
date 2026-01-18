import { NextRequest, NextResponse } from "next/server";
import { publishPost } from "@/lib/threads-api";
import { initializeTokensInDB } from "@/lib/threads-api";

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
        const { content, imageUrls = [] } = body;

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

        // Publish to Threads
        const threadsId = await publishPost(content, imageUrls);

        return NextResponse.json({
            success: true,
            threadsId,
            message: "Posted to Threads successfully!",
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
