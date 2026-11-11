import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyCronSecret } from "@/lib/cron-auth";
import { sendSystemAlert } from "@/lib/alert-service";
import { evaluateBrandShadowban } from "@/lib/shadowban-check";
import { parseBrandConfig } from "@/types/brand";

// Detects only. Shadowban mode (1 warmup post a day, no links) is switched on by the account-health banner, because the
// probe compares fresh, still-growing view counts with a settled baseline and a false positive would silently throttle
// a live account.
export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const brands = await prisma.brand.findMany({ select: { id: true, name: true, slug: true, brandConfig: true } });
  const results: Record<string, unknown>[] = [];
  let needsAttention = false;

  for (const brand of brands) {
    try {
      const config = parseBrandConfig(brand.brandConfig);
      // Publish already runs these brands warmup-only (cron/publish), so a daily repeat of the alert adds nothing.
      if (config.accountHealth?.status === "SHADOWBAN_SUSPECTED" || config.shadowbanStatus === "SHADOWBAN_SUSPECTED") {
        results.push({ slug: brand.slug, skipped: "already_in_shadowban_mode" });
        continue;
      }

      const report = await evaluateBrandShadowban(brand.id);
      results.push({
        slug: brand.slug,
        success: true,
        status: report.status,
        dropPercentage: report.dropPercentage,
        recentAverageViews: report.recentAverageViews,
        baselineAverageViews: report.baselineAverageViews,
        reasons: report.reasons,
      });

      if (report.status === "SHADOWBAN_SUSPECTED") {
        needsAttention = true;
        // ALERT_WEBHOOK_URL is unset in production, so the 500 below (red GitHub Actions run + email) is what reaches someone.
        await sendSystemAlert({
          level: "error",
          title: "Shadowban suspected",
          message: `${report.reasons.join(" ")} (recent avg ${report.recentAverageViews} views vs baseline ${report.baselineAverageViews}). Nothing was changed: use "웜업 모드 강제 전환" on the account-health banner to apply shadowban mode, or ignore it if the dip is expected.`,
          brandName: brand.name,
          metadata: { dropPercentage: report.dropPercentage, consecutiveDepressedCount: report.consecutiveDepressedCount },
        });
      }
    } catch (error) {
      console.error(`[cron/shadowban-check] ${brand.slug}: check failed`, error);
      needsAttention = true;
      results.push({
        slug: brand.slug,
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return NextResponse.json({ success: !needsAttention, brands: results }, { status: needsAttention ? 500 : 200 });
}
