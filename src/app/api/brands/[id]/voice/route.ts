import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { extractVoiceProfile } from "@/lib/voice-extractor";
import { parseBrandConfig } from "@/types/brand";

interface VoiceRequestPayload {
  samples?: string[];
  useTopPosts?: boolean;
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: brandId } = await context.params;
    const brand = await prisma.brand.findUnique({
      where: { id: brandId },
      select: { id: true, brandConfig: true },
    });

    if (!brand) {
      return NextResponse.json({ error: "Brand not found" }, { status: 404 });
    }

    const body = (await request.json().catch(() => ({}))) as VoiceRequestPayload;
    let sampleTexts: string[] = body.samples ?? [];

    if (sampleTexts.length === 0 || body.useTopPosts) {
      // 해당 브랜드의 과거 고성과 포스트 5개 로드
      const topPosts = await prisma.post.findMany({
        where: {
          brandId,
          status: "PUBLISHED",
          performanceScore: { not: null },
        },
        orderBy: { performanceScore: "desc" },
        take: 5,
        select: { content: true },
      });

      if (topPosts.length > 0) {
        sampleTexts = topPosts.map((p) => p.content);
      }
    }

    const voiceProfile = extractVoiceProfile(sampleTexts);
    const currentConfig = parseBrandConfig(brand.brandConfig);

    const updatedConfig = {
      ...currentConfig,
      voiceProfile,
    };

    await prisma.brand.update({
      where: { id: brandId },
      data: {
        brandConfig: JSON.stringify(updatedConfig),
      },
    });

    return NextResponse.json({
      success: true,
      brandId,
      sampleCount: sampleTexts.length,
      voiceProfile,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to extract voice profile" },
      { status: 500 }
    );
  }
}
