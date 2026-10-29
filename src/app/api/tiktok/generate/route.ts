// src/app/api/tiktok/generate/route.ts — Generate TikTok short-form script and save as draft.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { accessErrorResponse, requireBrandForCurrentUser } from "@/lib/brand-access";
import { generateTikTokScript } from "@/lib/tiktok/tiktok-script-engine";
import { buildTikTokDraftCreateData, resolveTikTokEngine } from "@/lib/tiktok/tiktok-draft-service";
import { generateProductScript } from "@/lib/tiktok/product-script-engine";
import { brandVideoLang } from "@/lib/new-year/new-year-season";
import { getDomainPreset } from "@/lib/domain-registry";
import { parseBrandConfig } from "@/types/brand";

const PRODUCT_TONES = ["mysterious", "urgent", "encouraging"] as const;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { brandId, topic, dayMaster, tone } = body;

    if (!brandId) {
      return NextResponse.json({ error: "brandId is required" }, { status: 400 });
    }

    const { brand } = await requireBrandForCurrentUser(brandId);

    const config = parseBrandConfig(brand.brandConfig);
    const engine = resolveTikTokEngine(brand.slug, config.qualityProfile);
    const preset = getDomainPreset(config.qualityProfile);

    const scriptResult = engine === "saju"
      ? generateTikTokScript({
        topic: topic || "사주 대운 분석",
        dayMaster: dayMaster || "갑목",
        tone: tone || "mysterious",
        lang: brandVideoLang(brand.slug),
      })
      : await generateProductScript({
        brandName: brand.name,
        productProfile: config.productProfile,
        preset,
        topic: (typeof topic === "string" && topic.trim()) || preset.defaultTopics[0] || brand.name,
        tone: PRODUCT_TONES.find((allowed) => allowed === tone) ?? "mysterious",
        lang: brandVideoLang(brand.slug),
      });

    const draft = await prisma.tikTokVideoDraft.create({
      data: buildTikTokDraftCreateData(brand.id, scriptResult, "DRAFT", engine),
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
