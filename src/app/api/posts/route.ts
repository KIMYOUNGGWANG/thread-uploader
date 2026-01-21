import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ParsedPost, validatePost } from "@/lib/parser";

interface CreatePostsRequest {
    posts: ParsedPost[];
}

export async function POST(request: NextRequest) {
    try {
        const body = (await request.json()) as CreatePostsRequest;
        const { posts } = body;

        if (!posts || !Array.isArray(posts) || posts.length === 0) {
            return NextResponse.json(
                { error: "No posts provided" },
                { status: 400 }
            );
        }

        // Validate all posts
        const validationResults = posts.map((post, index) => ({
            index,
            ...validatePost(post),
        }));

        const invalidPosts = validationResults.filter((r) => !r.valid);
        if (invalidPosts.length > 0) {
            return NextResponse.json(
                {
                    error: "Some posts are invalid",
                    details: invalidPosts.map((p) => ({
                        index: p.index,
                        errors: p.errors,
                    })),
                },
                { status: 400 }
            );
        }

        // Create all posts in the database
        const now = Date.now();
        const createdPosts = await Promise.all(
            posts.map((post, index) =>
                prisma.post.create({
                    data: {
                        content: post.content,
                        imageUrls: JSON.stringify(post.images),
                        // If no scheduled time, add 1 minute increment per post to preserve order
                        scheduledAt: post.scheduledAt || new Date(now + index * 60000),
                        status: "PENDING",
                    },
                })
            )
        );

        return NextResponse.json({
            success: true,
            count: createdPosts.length,
            posts: createdPosts.map((p) => ({
                id: p.id,
                scheduledAt: p.scheduledAt,
                status: p.status,
            })),
        });
    } catch (error) {
        console.error("Error creating posts:", error);
        return NextResponse.json(
            { error: "Failed to create posts" },
            { status: 500 }
        );
    }
}

export async function GET() {
    try {
        const posts = await prisma.post.findMany({
            orderBy: { scheduledAt: "asc" },
        });

        return NextResponse.json({
            posts: posts.map((p) => ({
                ...p,
                imageUrls: JSON.parse(p.imageUrls),
            })),
        });
    } catch (error) {
        console.error("Error fetching posts:", error);
        return NextResponse.json(
            { error: "Failed to fetch posts" },
            { status: 500 }
        );
    }
}
