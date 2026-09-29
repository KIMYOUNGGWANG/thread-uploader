// src/app/api/tiktok/render/route.ts — Render TikTok video draft into MP4 using Remotion.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildTikTokRenderSpec, executeTikTokRender } from "@/lib/tiktok/tiktok-render-worker";
import type { TikTokSceneBeat } from "@/lib/tiktok/tiktok-script-engine";

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

    const scenes: TikTokSceneBeat[] = JSON.parse(draft.sceneBeats || "[]");
    const hashtags: string[] = JSON.parse(draft.hashtags || "[]");

    const scriptResult = {
      title: draft.title,
      spokenHook: draft.spokenHook,
      fullScript: draft.script,
      totalDurationSeconds: draft.durationSeconds,
      scenes,
      cta: draft.cta,
      hashtags,
      qualityScore: draft.qualityScore,
      qualityPass: draft.qualityPass,
    };

    const renderSpec = buildTikTokRenderSpec(scriptResult);

    if (dryRun) {
      await prisma.tikTokVideoDraft.update({
        where: { id: draftId },
        data: { status: "RENDERING" },
      });

      const renderResult = await executeTikTokRender(renderSpec, {
        dryRun: true,
        outputFileName: `${draft.id}.mp4`,
      });

      if (renderResult.success) {
        const updatedDraft = await prisma.tikTokVideoDraft.update({
          where: { id: draftId },
          data: {
            status: "COMPLETED",
            utmContent: renderResult.outputPath,
          },
        });

        return NextResponse.json({
          success: true,
          draft: updatedDraft,
          renderResult,
        });
      } else {
        const failedDraft = await prisma.tikTokVideoDraft.update({
          where: { id: draftId },
          data: {
            status: "FAILED",
            qualityReasons: JSON.stringify([renderResult.error || "Rendering failed"]),
          },
        });

        return NextResponse.json(
          {
            success: false,
            draft: failedDraft,
            error: renderResult.error,
          },
          { status: 500 }
        );
      }
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
  } catch (error: any) {
    console.error("[api/tiktok/render] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to process render request" },
      { status: 500 }
    );
  }
}
