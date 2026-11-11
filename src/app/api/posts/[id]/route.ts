import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { accessErrorResponse, requirePostForCurrentUser } from "@/lib/brand-access";
import { REQUEUE_CONFLICT_MESSAGE, REQUEUEABLE_POST_STATUSES, isRecordNotFoundError, isRequeueable } from "@/lib/post-status";
import { reviewDecisionFor } from "@/lib/review-decision";
import { MAX_ITEMS, MAX_SLIDES, MIN_SLIDES, parseCardSlides } from "@/lib/wellness/slides";
import { recheckQualityReasons } from "@/lib/wellness/compliance";
import { isCardFirstBrand } from "@/lib/wellness/config";
import { buildCardFirstCaption } from "@/lib/distribution/captions";
import { cardFirstSlideUrls } from "@/lib/distribution/scheduler";
import { parseBrandConfig } from "@/types/brand";

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
            cardSlides?: unknown;
            instagramCaption?: unknown;
        };

        // Card-first drafts: slide edits must still be a valid 7-10 card set (Instagram carousel limit).
        let cardSlides: string | undefined;
        if (body.cardSlides !== undefined) {
            const raw = Array.isArray(body.cardSlides) ? body.cardSlides : [];
            const slides = parseCardSlides(JSON.stringify(raw));
            const valid = slides.length === raw.length && slides.length >= MIN_SLIDES && slides.length <= MAX_SLIDES
                && slides.every((slide) => slide.headline.trim().length > 0 && (slide.items?.length ?? 0) <= MAX_ITEMS);
            if (!valid) {
                return NextResponse.json({ error: `카드는 제목이 있는 ${MIN_SLIDES}~${MAX_SLIDES}장, 목록은 장당 ${MAX_ITEMS}개까지예요` }, { status: 400 });
            }
            cardSlides = JSON.stringify(slides);
        }

        if (body.status !== undefined && !(typeof body.status === "string" && EDITABLE_STATUSES.has(body.status))) {
            return NextResponse.json({ error: "status는 PENDING 또는 NEEDS_REVIEW만 가능합니다" }, { status: 400 });
        }
        // A status change sends the post to the queue the publish cron reads, so it is only allowed while nothing has
        // been (or is being) published from it. Edits that leave the status alone stay open: card-first brands edit
        // slides and caption of posts that are already PUBLISHED on Threads.
        const statusChange = typeof body.status === "string";
        if (statusChange && !isRequeueable(post.status)) {
            return NextResponse.json({ error: REQUEUE_CONFLICT_MESSAGE }, { status: 409 });
        }
        // Approving to PENDING is the human review: it clears the quality/score gates (policy checks still run at publish)
        const isApproval = body.status === "PENDING";

        const data = {
            ...(typeof body.content === "string" && { content: body.content, ...(!isApproval && { algorithmicPass: null }) }),
            ...(Array.isArray(body.imageUrls) && { imageUrls: JSON.stringify(body.imageUrls) }),
            ...(typeof body.scheduledAt === "string" && { scheduledAt: new Date(body.scheduledAt) }),
            ...(typeof body.firstComment === "string" && { firstComment: body.firstComment }),
            ...(typeof body.status === "string" && { status: body.status }),
            ...(cardSlides !== undefined && { cardSlides }),
            ...(typeof body.instagramCaption === "string" && { instagramCaption: body.instagramCaption.slice(0, 2200) }),
            ...(isApproval && { qualityPass: true, algorithmicPass: true }),
        };

        // Card-first posts: re-check the edited text for banned health claims, and push edits into a carousel that is
        // still waiting out its cancel window (its caption and slide URLs were copied when it was queued).
        const brandConfig = post.brand?.brandConfig ?? "{}";
        const textEdited = typeof body.content === "string" || cardSlides !== undefined || typeof body.instagramCaption === "string";
        const cardFirst = isCardFirstBrand(brandConfig) && textEdited;
        const next = {
            content: typeof body.content === "string" ? body.content : post.content,
            instagramCaption: typeof body.instagramCaption === "string" ? body.instagramCaption : post.instagramCaption,
            cardSlides: cardSlides ?? post.cardSlides,
        };
        const finalData = cardFirst
            ? { ...data, qualityReasons: recheckQualityReasons(post.qualityReasons, { ...next, slides: parseCardSlides(next.cardSlides) }, brandConfig) }
            : data;

        const decision = isApproval ? reviewDecisionFor(post, "APPROVED", body.reason) : null;
        // The status filter makes the write itself conditional: `post` was read at the start of the request, and the cron
        // may have claimed it since. No match throws P2025 and the transaction (decision row included) rolls back.
        const where = statusChange ? { id, status: { in: REQUEUEABLE_POST_STATUSES } } : { id };
        const operations: Prisma.PrismaPromise<unknown>[] = [prisma.post.update({ where, data: finalData })];
        if (cardFirst) {
            operations.push(prisma.channelUpload.updateMany({
                where: { postId: id, kind: "carousel", status: "QUEUED" },
                data: {
                    caption: buildCardFirstCaption(next.instagramCaption, next.content, parseBrandConfig(brandConfig).instagram.captionSuffix),
                    mediaUrls: JSON.stringify(cardFirstSlideUrls(id, next.cardSlides)),
                },
            }));
        }
        if (decision) operations.push(prisma.reviewDecision.create({ data: decision }));
        try {
            const [updatedPost] = await prisma.$transaction(operations);
            return NextResponse.json({ success: true, post: updatedPost });
        } catch (error) {
            if (statusChange && isRecordNotFoundError(error)) {
                return NextResponse.json({ error: REQUEUE_CONFLICT_MESSAGE }, { status: 409 });
            }
            throw error;
        }
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
