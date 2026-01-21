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

        // KST optimal posting times (hour:minute) - 10 slots per day, 90 min apart
        const KST_SLOTS = [
            { hour: 7, minute: 0 },   // 07:00 KST
            { hour: 8, minute: 30 },  // 08:30 KST
            { hour: 10, minute: 0 },  // 10:00 KST
            { hour: 11, minute: 30 }, // 11:30 KST
            { hour: 13, minute: 0 },  // 13:00 KST
            { hour: 14, minute: 30 }, // 14:30 KST
            { hour: 16, minute: 0 },  // 16:00 KST
            { hour: 17, minute: 30 }, // 17:30 KST
            { hour: 19, minute: 0 },  // 19:00 KST
            { hour: 20, minute: 30 }, // 20:30 KST
        ];

        // Calculate schedule starting from tomorrow (KST)
        const now = new Date();
        const kstOffset = 9 * 60 * 60 * 1000; // KST is UTC+9
        const nowKST = new Date(now.getTime() + kstOffset);

        // Start from the next day at 07:00 KST
        const startDate = new Date(nowKST);
        startDate.setUTCDate(startDate.getUTCDate() + 1);
        startDate.setUTCHours(7 - 9, 0, 0, 0); // 07:00 KST = 22:00 UTC previous day

        // Create all posts in the database with proper KST scheduling
        const createdPosts = await Promise.all(
            posts.map((post, index) => {
                let scheduledAt: Date;

                if (post.scheduledAt) {
                    scheduledAt = new Date(post.scheduledAt);
                } else {
                    // Calculate which day and which slot
                    const dayOffset = Math.floor(index / KST_SLOTS.length);
                    const slotIndex = index % KST_SLOTS.length;
                    const slot = KST_SLOTS[slotIndex];

                    // Create the scheduled date
                    scheduledAt = new Date(startDate);
                    scheduledAt.setUTCDate(scheduledAt.getUTCDate() + dayOffset);
                    // Convert KST hour to UTC (KST - 9 = UTC)
                    scheduledAt.setUTCHours(slot.hour - 9, slot.minute, 0, 0);
                }

                return prisma.post.create({
                    data: {
                        content: post.content,
                        imageUrls: JSON.stringify(post.images),
                        scheduledAt,
                        status: "PENDING",
                    },
                });
            })
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
