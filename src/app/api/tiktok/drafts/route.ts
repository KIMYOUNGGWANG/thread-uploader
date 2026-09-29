// src/app/api/tiktok/drafts/route.ts — List TikTok video drafts for a brand.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const brandId = searchParams.get("brandId");

    const where = brandId ? { brandId } : {};

    const drafts = await prisma.tikTokVideoDraft.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        metrics: {
          orderBy: { measuredAt: "desc" },
          take: 1,
        },
      },
    });

    return NextResponse.json({ success: true, drafts });
  } catch (error: any) {
    console.error("[api/tiktok/drafts] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch drafts" },
      { status: 500 }
    );
  }
}
