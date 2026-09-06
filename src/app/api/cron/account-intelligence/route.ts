import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { runAccountIntelligence } from "@/lib/account-intelligence";
import { verifyCronSecret } from "@/lib/cron-auth";

export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const brands = await prisma.brand.findMany({ select: { id: true, slug: true } });
  const results = [];

  for (const brand of brands) {
    try {
      const insight = await runAccountIntelligence(brand.id, {
        fetchMetrics: true,
        windowHours: 48,
        source: "cron",
      });
      results.push({
        slug: brand.slug,
        success: true,
        actions: insight.actions.length,
        highPriority: insight.actions.filter((action) => action.priority === "high").length,
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
