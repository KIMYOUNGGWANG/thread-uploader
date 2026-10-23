import { NextRequest, NextResponse } from "next/server";
import { sendSystemAlert } from "@/lib/alert-service";
import { verifyCronSecret } from "@/lib/cron-auth";
import { getFreshInstagramCredentials } from "@/lib/instagram-api";
import { runInstagramReelsTick, type ReelsTickResult } from "@/lib/instagram-reels-sync";

export const maxDuration = 60;

type InstagramBrand = { id: string; slug: string; name: string; brandConfig: string; instagramConnectedAt: Date | null };
type BrandResult = { slug: string; skipped: "not_connected" } | { slug: string; error: string } | ({ slug: string } & ReelsTickResult);

/** Cron (every 15 min): cross-posts Threads video posts as Instagram reels. Independent of /api/cron/publish. */
export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const brands = await findInstagramBrands(request);
  const now = new Date();
  const results: BrandResult[] = [];
  for (const brand of brands) {
    results.push(await runBrandTick(brand, now));
  }
  return NextResponse.json({ results });
}

// Optional ?brands=slug1,slug2 limits the run; otherwise every Instagram-connected brand.
async function findInstagramBrands(request: NextRequest): Promise<InstagramBrand[]> {
  const { prisma } = await import("@/lib/prisma");
  const brandSlugs = request.nextUrl.searchParams.get("brands")?.split(",").map((slug) => slug.trim()).filter(Boolean);
  return prisma.brand.findMany({
    where: { instagramConnectedAt: { not: null }, ...(brandSlugs?.length ? { slug: { in: brandSlugs } } : {}) },
    select: { id: true, slug: true, name: true, brandConfig: true, instagramConnectedAt: true },
  });
}

async function runBrandTick(brand: InstagramBrand, now: Date): Promise<BrandResult> {
  try {
    const credentials = await getFreshInstagramCredentials(brand.id);
    const connectedAt = brand.instagramConnectedAt;
    if (!credentials || !connectedAt) return { slug: brand.slug, skipped: "not_connected" };
    const tick = await runInstagramReelsTick({ ...brand, instagramConnectedAt: connectedAt }, credentials, now);
    return { slug: brand.slug, ...tick };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    await sendSystemAlert({
      level: "error",
      title: `Instagram Publish Cron Failed (${brand.name})`,
      message: `Instagram reels tick failed for brand "${brand.name}": ${message}`,
      brandName: brand.name,
    });
    return { slug: brand.slug, error: message };
  }
}
