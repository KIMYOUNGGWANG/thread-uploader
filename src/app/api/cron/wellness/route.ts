import { NextRequest, NextResponse } from "next/server";
import { verifyCronSecret } from "@/lib/cron-auth";
import { prisma } from "@/lib/prisma";
import { readWellnessConfig } from "@/lib/wellness/config";
import { runWellnessForBrand, type WellnessRunResult } from "@/lib/wellness/pipeline";

export const maxDuration = 300; // feed fetches + one scoring call + up to 5 drafts with one rewrite each

// Daily research → draft run for every brand with brandConfig.wellness. Drafts land as NEEDS_REVIEW for the morning review.
export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const brands = await prisma.brand.findMany({ select: { id: true, slug: true, brandConfig: true } });
  const now = new Date();
  const results: WellnessRunResult[] = [];
  for (const brand of brands.filter((b) => readWellnessConfig(b.brandConfig))) {
    try {
      results.push(await runWellnessForBrand(brand, now));
    } catch (error) {
      results.push({ slug: brand.slug, collected: 0, scored: 0, drafted: [], failed: 0, errors: [error instanceof Error ? error.message : String(error)] });
    }
  }
  return NextResponse.json({ ok: true, results });
}
