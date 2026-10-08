import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { accessErrorResponse, requirePostForCurrentUser } from "@/lib/brand-access";

const EDITABLE_STATUSES = new Set(["PENDING", "NEEDS_REVIEW"]);

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
            status?: unknown;
        };

        if (body.status !== undefined && !(typeof body.status === "string" && EDITABLE_STATUSES.has(body.status))) {
            return NextResponse.json({ error: "status는 PENDING 또는 NEEDS_REVIEW만 가능합니다" }, { status: 400 });
        }
        // Approving to PENDING is the human review: it clears the quality/score gates (policy checks still run at publish)
        const isApproval = body.status === "PENDING";

        const data = {
            ...(typeof body.content === "string" && { content: body.content, ...(!isApproval && { algorithmicPass: null }) }),
            ...(Array.isArray(body.imageUrls) && { imageUrls: JSON.stringify(body.imageUrls) }),
            ...(typeof body.scheduledAt === "string" && { scheduledAt: new Date(body.scheduledAt) }),
            ...(typeof body.firstComment === "string" && { firstComment: body.firstComment }),
            ...(typeof body.status === "string" && { status: body.status }),
            ...(isApproval && { qualityPass: true, algorithmicPass: true }),
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
