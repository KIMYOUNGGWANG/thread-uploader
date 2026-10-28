import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { accessErrorResponse, requirePostForCurrentUser } from "@/lib/brand-access";
import { reviewDecisionFor } from "@/lib/review-decision";

const EDITABLE_STATUSES = new Set(["PENDING", "NEEDS_REVIEW"]);

interface RouteParams {
    params: Promise<{ id: string }>;
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
    try {
        const { id } = await params;
        const { post } = await requirePostForCurrentUser(id);
        // The body is optional: older callers send a bare DELETE with no reason.
        const body: unknown = await request.json().catch(() => null);
        const reason = typeof body === "object" && body !== null ? (body as Record<string, unknown>).reason : undefined;

        const decision = reviewDecisionFor(post, "REJECTED", reason);
        const operations: Prisma.PrismaPromise<unknown>[] = [];
        if (decision) operations.push(prisma.reviewDecision.create({ data: decision }));
        operations.push(prisma.post.delete({ where: { id } }));
        await prisma.$transaction(operations);

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
        const { post } = await requirePostForCurrentUser(id);
        const body = await request.json() as {
            content?: unknown;
            imageUrls?: unknown;
            scheduledAt?: unknown;
            firstComment?: unknown;
            status?: unknown;
            reason?: unknown;
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

        const decision = isApproval ? reviewDecisionFor(post, "APPROVED", body.reason) : null;
        const operations: Prisma.PrismaPromise<unknown>[] = [prisma.post.update({ where: { id }, data })];
        if (decision) operations.push(prisma.reviewDecision.create({ data: decision }));
        const [updatedPost] = await prisma.$transaction(operations);

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
