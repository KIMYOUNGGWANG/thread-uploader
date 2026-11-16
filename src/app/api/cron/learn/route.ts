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
        learningInputDiff: result.learningInputDiff,
        promotedFormulas: result.promotedFormulas,
        demotedFormulas: result.demotedFormulas,
        weeklyLift: result.weeklyLift,
      });
    } catch (error) {
      console.error(`[cron/learn] ${brand.slug}: learning failed`, error);
      results.push({
        slug: brand.slug,
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  // ALERT_WEBHOOK_URL is unset in production, so a non-2xx answer (red fetch-metrics.yml run + email) is the alert
  // that reaches someone. The other brands were still learned above.
  const failed = results.some((result) => !result.success);
  return NextResponse.json({ success: !failed, brands: results }, { status: failed ? 500 : 200 });
}
