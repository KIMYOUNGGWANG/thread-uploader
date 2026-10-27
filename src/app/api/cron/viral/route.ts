import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { discoverViralExamples, learnViralPatterns } from "@/lib/viral-service";
import { verifyCronSecret } from "@/lib/cron-auth";
import { analyzeTopViralExamples } from "@/lib/viral-llm-analysis";
import { sendSystemAlert } from "@/lib/alert-service";
import { parseBrandConfig } from "@/types/brand";

export const maxDuration = 300; // discovery + Claude analysis per brand

export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const brands = await prisma.brand.findMany({ select: { id: true, slug: true, name: true, brandConfig: true } });
  const results = [];
  const externalSourcesFailed: string[] = [];

  for (const brand of brands) {
    // No keywords = nothing to search; skip so brands without a radar setup don't burn quota or raise false alarms.
    if (parseBrandConfig(brand.brandConfig).viralDiscovery.keywords.length === 0) {
      results.push({ slug: brand.slug, skipped: "no_keywords" });
      continue;
    }
    try {
      const discovery = await discoverViralExamples(brand.id, { includeOwnPosts: true, limit: 10 });
      // Claude analysis is an enrichment: a failure must not block pattern learning.
      const llmAnalysis = await analyzeTopViralExamples(brand.id).catch((error: unknown) => ({
        analyzed: 0,
        error: error instanceof Error ? error.message : "Claude analysis failed",
      }));
      const learning = await learnViralPatterns(brand.id);
      if (discovery.externalAllFailed) {
        externalSourcesFailed.push(brand.slug);
        await sendSystemAlert({
          level: "error",
          title: "Viral discovery failed",
          message: discovery.errors.map((error) => error.message).join(", "),
          brandName: brand.name,
        });
      }
      results.push({
        slug: brand.slug,
        success: true,
        saved: discovery.saved,
        learnedPatterns: learning.learnedPatterns,
        llmAnalysis,
        errors: discovery.errors,
      });
    } catch (error) {
      results.push({
        slug: brand.slug,
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  // Own-post learning still ran above, but a run where every keyword/profile source failed has
  // collected no outside references, so surface it as a failure instead of a silent green run.
  if (externalSourcesFailed.length > 0) {
    return NextResponse.json({ success: false, externalSourcesFailed, brands: results }, { status: 500 });
  }
  return NextResponse.json({ success: true, brands: results });
}
