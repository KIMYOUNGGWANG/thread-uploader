import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyCronSecret } from "@/lib/cron-auth";
import { isAdapterEnabled } from "@/lib/viral-service";
import { parseBrandConfig } from "@/types/brand";
import { discoverShorts } from "@/lib/youtube/shorts-service";

export const maxDuration = 300; // search.list + videos.list per brand

async function loadTargetBrands(slugs: string[]) {
  const brands = await prisma.brand.findMany({
    where: slugs.length > 0 ? { slug: { in: slugs } } : undefined,
    select: { id: true, slug: true, brandConfig: true },
  });
  // Explicit ?brands= wins over the toggle; without it, only brands that opted in run.
  if (slugs.length > 0) return brands;
  return brands.filter((brand) =>
    isAdapterEnabled(parseBrandConfig(brand.brandConfig).viralDiscovery.adapters, "youtube_shorts")
  );
}

async function runBrand(brand: { id: string; slug: string }) {
  try {
    return { slug: brand.slug, ...(await discoverShorts(brand.id)) };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Shorts discovery failed";
    return { slug: brand.slug, quotaUsed: 0, errors: [{ adapter: "youtube_shorts", source: "route", message }] };
  }
}

export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const slugs = request.nextUrl.searchParams.get("brands")?.split(",").map((slug) => slug.trim()).filter(Boolean) ?? [];

  const results = [];
  for (const brand of await loadTargetBrands(slugs)) {
    results.push(await runBrand(brand));
  }
  return NextResponse.json({ success: true, brands: results });
}
