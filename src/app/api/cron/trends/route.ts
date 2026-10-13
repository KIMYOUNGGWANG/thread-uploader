import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyCronSecret } from "@/lib/cron-auth";
import { refreshBrandTrendRadar } from "@/lib/trend-radar/trend-radar-service";

export const maxDuration = 300; // parallel web-search harvest + transposition

export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // Required ?brands=slug1,slug2: the harvest costs web-search calls, so it never fans out to every brand.
  const brandSlugs = request.nextUrl.searchParams.get("brands")?.split(",").map((slug) => slug.trim()).filter(Boolean) ?? [];
  if (brandSlugs.length === 0) {
    return NextResponse.json({ error: "brands query parameter is required" }, { status: 400 });
  }

  const brands = await prisma.brand.findMany({
    where: { slug: { in: brandSlugs } },
    select: { id: true, slug: true, name: true, brandConfig: true },
  });
  const results = [];
  for (const brand of brands) {
    try {
      results.push({ success: true, ...(await refreshBrandTrendRadar(brand)) });
    } catch (error) {
      results.push({ slug: brand.slug, success: false, error: error instanceof Error ? error.message : "Trend radar failed" });
    }
  }
  return NextResponse.json({ success: true, brands: results });
}
