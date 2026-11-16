// src/app/api/tiktok/render/route.ts — Render TikTok video draft into MP4 using Remotion.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { accessErrorResponse, requireBrandForCurrentUser } from "@/lib/brand-access";
import { buildTikTokRenderSpec } from "@/lib/tiktok/tiktok-render-worker";
import { draftToScriptResult } from "@/lib/tiktok/tiktok-draft-service";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { draftId, dryRun = true } = body;

    if (!draftId) {
      return NextResponse.json({ error: "draftId is required" }, { status: 400 });
    }

    const draft = await prisma.tikTokVideoDraft.findUnique({
      where: { id: draftId },
    });

    if (!draft) {
      return NextResponse.json({ error: "Draft not found" }, { status: 404 });
    }
    await requireBrandForCurrentUser(draft.brandId);

    // Dry run = spec check only: same spec the worker renders, no draft update, no disk write.
    if (dryRun) {
      const renderSpec = buildTikTokRenderSpec(draftToScriptResult(draft));
      return NextResponse.json({ success: true, dryRun: true, renderSpec });
    }

    // Serverless-safe decoupled execution: queue for local/standalone worker
    const queuedDraft = await prisma.tikTokVideoDraft.update({
      where: { id: draftId },
      data: { status: "QUEUED" },
    });

    return NextResponse.json(
      {
        success: true,
        queued: true,
        draft: queuedDraft,
        message: "렌더링 작업이 백그라운드 큐에 등록되었습니다. 로컬 워커(npm run worker:tiktok)에서 렌더링됩니다.",
      },
      { status: 202 }
    );
  } catch (error: unknown) {
    const accessResponse = accessErrorResponse(error);
    if (accessResponse) return accessResponse;
    console.error("[api/tiktok/render] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to process render request" },
      { status: 500 }
    );
  }
}
