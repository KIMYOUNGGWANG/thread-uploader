import { NextRequest, NextResponse } from "next/server";
import { accessErrorResponse, requireTikTokDraftForCurrentUser } from "@/lib/brand-access";
import { parseDraftStatus, updateTikTokVideoDraft } from "@/lib/tiktok-video-service";
import type { TikTokSceneBeat } from "@/types/tiktok-video";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    await requireTikTokDraftForCurrentUser(id);
    const body = await request.json() as {
      status?: unknown;
      title?: unknown;
      spokenHook?: unknown;
      script?: unknown;
      sceneBeats?: unknown;
      captionOverlays?: unknown;
      onScreenText?: unknown;
      hashtags?: unknown;
      cta?: unknown;
    };
    const status = body.status === undefined ? undefined : parseDraftStatus(body.status);
    if (body.status !== undefined && !status) {
      return NextResponse.json({ error: "Invalid TikTok draft status" }, { status: 400 });
    }

    const draft = await updateTikTokVideoDraft(id, {
      ...(status && { status }),
      ...(typeof body.title === "string" && { title: body.title }),
      ...(typeof body.spokenHook === "string" && { spokenHook: body.spokenHook }),
      ...(typeof body.script === "string" && { script: body.script }),
      ...(isSceneBeatList(body.sceneBeats) && { sceneBeats: body.sceneBeats }),
      ...(isStringList(body.captionOverlays) && { captionOverlays: body.captionOverlays }),
      ...(isStringList(body.onScreenText) && { onScreenText: body.onScreenText }),
      ...(isStringList(body.hashtags) && { hashtags: body.hashtags }),
      ...(typeof body.cta === "string" && { cta: body.cta }),
    });
    return NextResponse.json({ success: true, draft });
  } catch (error) {
    const response = accessErrorResponse(error);
    if (response) return response;
    if (error instanceof Error && error.message === "quality_failed") {
      return NextResponse.json({ error: "Quality fail draft cannot be approved" }, { status: 400 });
    }
    if (error instanceof Error && error.message === "approve_before_upload") {
      return NextResponse.json({ error: "Approve draft before marking manual upload" }, { status: 400 });
    }
    console.error("TikTok draft update error:", error);
    return NextResponse.json({ error: "Failed to update TikTok draft" }, { status: 500 });
  }
}

function isStringList(input: unknown): input is string[] {
  return Array.isArray(input) && input.every((value) => typeof value === "string");
}

function isSceneBeatList(input: unknown): input is TikTokSceneBeat[] {
  return Array.isArray(input) && input.every((value) => {
    if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
    const beat = value as Record<string, unknown>;
    return typeof beat.startSecond === "number"
      && typeof beat.endSecond === "number"
      && typeof beat.visualDirection === "string"
      && typeof beat.narration === "string";
  });
}
