// src/app/api/tiktok/generate/route.ts — Generate TikTok short-form script and save as draft.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { accessErrorResponse, requireBrandForCurrentUser } from "@/lib/brand-access";
import { generateTikTokScript } from "@/lib/tiktok/tiktok-script-engine";
import { buildTikTokDraftCreateData } from "@/lib/tiktok/tiktok-draft-service";

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
      data: buildTikTokDraftCreateData(brand.id, scriptResult, "DRAFT"),
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
