import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * DELETE /api/posts/reset
 * Deletes all PENDING posts in one go
 */
export async function DELETE() {
    try {
        const result = await prisma.post.deleteMany({
            where: {
                status: "PENDING",
            },
        });

        return NextResponse.json({
            success: true,
            message: `Deleted ${result.count} pending posts`,
            count: result.count,
        });
    } catch (error) {
        console.error("Reset error:", error);
        return NextResponse.json(
            { error: "Failed to reset posts" },
            { status: 500 }
        );
    }
}
