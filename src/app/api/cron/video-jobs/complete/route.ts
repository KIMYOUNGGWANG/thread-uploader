import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyCronSecret } from "@/lib/cron-auth";
import { isVideoMediaUrl } from "@/lib/media-url";
import { buildVideoPostCaption } from "@/lib/tiktok/tiktok-draft-service";

/**
 * POST /api/cron/video-jobs/complete  { draftId, videoUrl } | { draftId, error }
 * Records the CI render result. A rendered video becomes a NEEDS_REVIEW Threads post;
 * the operator approves it in the dashboard before it is published.
 */
export async function POST(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json() as { draftId?: unknown; videoUrl?: unknown; error?: unknown };
  if (typeof body.draftId !== "string") {
    return NextResponse.json({ error: "draftId is required" }, { status: 400 });
  }

  const draft = await prisma.tikTokVideoDraft.findUnique({ where: { id: body.draftId } });
  if (!draft || draft.status !== "RENDERING") {
    return NextResponse.json({ error: "Draft is not being rendered" }, { status: 409 });
  }

  if (typeof body.videoUrl !== "string" || !/^https:\/\//.test(body.videoUrl) || !isVideoMediaUrl(body.videoUrl)) {
    const reason = typeof body.error === "string" ? body.error : "Renderer returned no https .mp4 url";
    await prisma.tikTokVideoDraft.update({
      where: { id: draft.id },
      data: { status: "FAILED", qualityReasons: JSON.stringify([reason]) },
    });
    return NextResponse.json({ success: false, draftId: draft.id, error: reason });
  }

  const [, post] = await prisma.$transaction([
    prisma.tikTokVideoDraft.update({
      where: { id: draft.id },
      data: { status: "COMPLETED", utmContent: body.videoUrl },
    }),
    prisma.post.create({
      data: {
        brandId: draft.brandId,
        content: buildVideoPostCaption(draft),
        imageUrls: JSON.stringify([body.videoUrl]),
        scheduledAt: new Date(),
        status: "NEEDS_REVIEW",
        formulaId: `video:${draft.formatId}`,
        campaignId: draft.campaignId,
        topic: draft.title,
        qualityReasons: JSON.stringify(["영상 포스트: 승인 후 발행"]),
      },
    }),
  ]);

  return NextResponse.json({ success: true, draftId: draft.id, postId: post.id });
}
