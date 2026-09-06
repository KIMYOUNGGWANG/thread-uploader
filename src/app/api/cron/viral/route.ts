import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { discoverViralExamples, learnViralPatterns } from "@/lib/viral-service";
import { verifyCronSecret } from "@/lib/cron-auth";

export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const brands = await prisma.brand.findMany({ select: { id: true, slug: true } });
  const results = [];

  for (const brand of brands) {
    try {
      const discovery = await discoverViralExamples(brand.id, { includeOwnPosts: true, limit: 10 });
      const learning = await learnViralPatterns(brand.id);
      results.push({
        slug: brand.slug,
        success: true,
        saved: discovery.saved,
        learnedPatterns: learning.learnedPatterns,
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

  return NextResponse.json({ success: true, brands: results });
}
