import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { learnBrandGrowth } from "@/lib/growth-service";
import { verifyCronSecret } from "@/lib/cron-auth";

export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const brands = await prisma.brand.findMany({ select: { id: true, slug: true } });
  const results = [];

  for (const brand of brands) {
    try {
      const result = await learnBrandGrowth(brand.id);
      results.push({
        slug: brand.slug,
        success: true,
        learnedPosts: result.learnedPosts,
        promotedFormulas: result.promotedFormulas,
        demotedFormulas: result.demotedFormulas,
      });
    } catch (error) {
      results.push({
        slug: brand.slug,
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return NextResponse.json({ success: true, brands: results });
}
