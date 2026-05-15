import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { accessErrorResponse, requirePostForCurrentUser } from "@/lib/brand-access";

interface RouteParams {
    params: Promise<{ id: string }>;
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
    try {
        const { id } = await params;
        await requirePostForCurrentUser(id);

        await prisma.post.delete({
            where: { id },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        const response = accessErrorResponse(error);
        if (response) return response;
        console.error("Error deleting post:", error);
        return NextResponse.json(
            { error: "Failed to delete post" },
            { status: 500 }
        );
    }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
    try {
        const { id } = await params;
        await requirePostForCurrentUser(id);
        const body = await request.json() as {
            content?: unknown;
            imageUrls?: unknown;
            scheduledAt?: unknown;
            firstComment?: unknown;
        };

        const data = {
            ...(typeof body.content === "string" && { content: body.content }),
            ...(Array.isArray(body.imageUrls) && { imageUrls: JSON.stringify(body.imageUrls) }),
            ...(typeof body.scheduledAt === "string" && { scheduledAt: new Date(body.scheduledAt) }),
            ...(typeof body.firstComment === "string" && { firstComment: body.firstComment }),
        };

        const updatedPost = await prisma.post.update({
            where: { id },
            data,
        });

        return NextResponse.json({ success: true, post: updatedPost });
    } catch (error) {
        const response = accessErrorResponse(error);
        if (response) return response;
        console.error("Error updating post:", error);
        return NextResponse.json(
            { error: "Failed to update post" },
            { status: 500 }
        );
    }
}
