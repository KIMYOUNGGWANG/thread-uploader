// src/app/api/tiktok/drafts/route.ts — List TikTok video drafts for a brand.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { accessErrorResponse, requireBrandForCurrentUser } from "@/lib/brand-access";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const brandId = searchParams.get("brandId");

    if (!brandId) {
      return NextResponse.json({ error: "brandId is required" }, { status: 400 });
    }
    await requireBrandForCurrentUser(brandId);

    const drafts = await prisma.tikTokVideoDraft.findMany({
      where: { brandId },
      orderBy: { createdAt: "desc" },
      include: {
        metrics: {
          orderBy: { measuredAt: "desc" },
          take: 1,
        },
      },
    });

    return NextResponse.json({ success: true, drafts });
  } catch (error: unknown) {
    const accessResponse = accessErrorResponse(error);
    if (accessResponse) return accessResponse;
    console.error("[api/tiktok/drafts] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch drafts" },
      { status: 500 }
    );
  }
}
