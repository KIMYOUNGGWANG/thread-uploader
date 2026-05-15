import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { accessErrorResponse, requireBrandForCurrentUser } from "@/lib/brand-access";
import { buildGrowthReport, parseStoredGrowthMemory } from "@/lib/growth-learning";

export async function GET(request: NextRequest) {
  try {
    const brandId = request.nextUrl.searchParams.get("brandId");
    if (!brandId) {
      return NextResponse.json({ error: "brandId is required" }, { status: 400 });
    }

    const { brand } = await requireBrandForCurrentUser(brandId);
    const posts = await prisma.post.findMany({
      where: {
        brandId,
        status: "PUBLISHED",
        metricsAt: { not: null },
      },
      orderBy: { metricsAt: "desc" },
      take: 200,
    });

    return NextResponse.json({
      brandId,
      ...buildGrowthReport(posts, parseStoredGrowthMemory(brand.growthMemory)),
    });
  } catch (error) {
    const response = accessErrorResponse(error);
    if (response) return response;
    console.error("Growth report error:", error);
    return NextResponse.json({ error: "Failed to load growth report" }, { status: 500 });
  }
}
