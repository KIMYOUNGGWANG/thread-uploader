// src/app/api/tiktok/generate/route.ts — Generate TikTok short-form script and save as draft.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { accessErrorResponse, requireBrandForCurrentUser } from "@/lib/brand-access";
import { generateTikTokScript } from "@/lib/tiktok/tiktok-script-engine";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { brandId, topic, dayMaster, tone } = body;

    if (!brandId) {
      return NextResponse.json({ error: "brandId is required" }, { status: 400 });
    }

    const { brand } = await requireBrandForCurrentUser(brandId);

    const scriptResult = generateTikTokScript({
      topic: topic || "사주 대운 분석",
      dayMaster: dayMaster || "갑목",
      tone: tone || "mysterious",
    });

    const draft = await prisma.tikTokVideoDraft.create({
      data: {
        brandId: brand.id,
        campaignId: "saju_tiktok_campaign",
        formatId: "tiktok_explainer_vertical",
        status: "DRAFT",
        title: scriptResult.title,
        spokenHook: scriptResult.spokenHook,
        script: scriptResult.fullScript,
        sceneBeats: JSON.stringify(scriptResult.scenes),
        captionOverlays: JSON.stringify(scriptResult.scenes.map((s) => s.spokenLine)),
        onScreenText: JSON.stringify(scriptResult.scenes.flatMap((s) => s.onScreenText)),
        hashtags: JSON.stringify(scriptResult.hashtags),
        cta: scriptResult.cta,
        qualityProfile: "tiktok_saju_retention",
        qualityPass: scriptResult.qualityPass,
        qualityScore: scriptResult.qualityScore,
        durationSeconds: Math.round(scriptResult.totalDurationSeconds),
      },
    });

    return NextResponse.json({
      success: true,
      draft,
      scriptResult,
    });
  } catch (error: unknown) {
    const accessResponse = accessErrorResponse(error);
    if (accessResponse) return accessResponse;
    console.error("[api/tiktok/generate] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate TikTok draft" },
      { status: 500 }
    );
  }
}
