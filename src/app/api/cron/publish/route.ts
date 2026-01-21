import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { publishPost } from "@/lib/threads-api";

/**
 * Cron endpoint for publishing scheduled posts
 * This should be called by Vercel Cron or similar scheduler
 * 
 * Security: Requires CRON_SECRET header or query param
 */
export async function GET(request: NextRequest) {
    // Verify cron secret
    const cronSecret = process.env.CRON_SECRET;
    const providedSecret =
        request.headers.get("authorization")?.replace("Bearer ", "") ||
        request.nextUrl.searchParams.get("secret");

    if (cronSecret && providedSecret !== cronSecret) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        // Find all pending posts that are due
        const now = new Date();
        // Add 1 minute buffer to handle slight clock skews or early cron execution
        // This ensures posts scheduled for 20:30:00 are picked up even if cron runs at 20:29:59
        const checkTime = new Date(now.getTime() + 60000);

        const pendingPosts = await prisma.post.findMany({
            where: {
                status: "PENDING",
                scheduledAt: {
                    lte: checkTime,
                },
            },
            orderBy: { scheduledAt: "asc" },
            orderBy: { scheduledAt: "asc" },
            // Process only 1 post per run. 
            // This prevents "bulk uploading" if the cron job is delayed or paused.
            // If backlog exists, it will catch up one by one in subsequent runs.
            take: 1,
        });

        if (pendingPosts.length === 0) {
            return NextResponse.json({
                message: "No pending posts to publish",
                processed: 0,
            });
        }

        const results: {
            id: string;
            success: boolean;
            threadsId?: string;
            error?: string;
        }[] = [];

        for (const post of pendingPosts) {
            try {
                // Parse image URLs
                const imageUrls = JSON.parse(post.imageUrls) as string[];

                // Publish to Threads
                const threadsId = await publishPost(post.content, imageUrls);

                // Update post status
                await prisma.post.update({
                    where: { id: post.id },
                    data: {
                        status: "PUBLISHED",
                        threadsId,
                    },
                });

                results.push({
                    id: post.id,
                    success: true,
                    threadsId,
                });

                // Add delay between posts to avoid rate limiting
                await new Promise((resolve) => setTimeout(resolve, 5000));
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : "Unknown error";

                // Update post status to failed
                await prisma.post.update({
                    where: { id: post.id },
                    data: {
                        status: "FAILED",
                        errorLog: errorMessage,
                    },
                });

                results.push({
                    id: post.id,
                    success: false,
                    error: errorMessage,
                });
            }
        }

        return NextResponse.json({
            message: "Cron job completed",
            processed: results.length,
            results,
        });
    } catch (error) {
        console.error("Cron job error:", error);
        return NextResponse.json(
            { error: "Cron job failed" },
            { status: 500 }
        );
    }
}
