import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getFreshBrandCredentials } from "@/lib/threads-api";
import { verifyCronSecret } from "@/lib/cron-auth";
import { publishDueDraftReplies, scanAndDraftRepliesForBrand } from "@/lib/threads/reply-mention-engine";
import { parseBrandConfig } from "@/types/brand";

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // An expired Threads token can't be refreshed (only an OAuth reconnect fixes it), so skip those brands.
  const brands = await prisma.brand.findMany({
    where: { accessToken: { not: null }, tokenExpiry: { gt: new Date() } },
  });
  if (brands.length === 0) {
    return NextResponse.json({ message: "No brands found", results: [] });
  }

  const results = [];

  for (const brand of brands) {
    try {
      const brandConfig = parseBrandConfig(brand.brandConfig || "{}");

      const credentials = await getFreshBrandCredentials(brand.id);
      const language = brandConfig.voiceProfile?.language === "en" || brandConfig.qualityProfile === "ecommerce_d2c" ? "en" : "ko";
      // Publish first: it is bounded (3 × ~7s) while a scan with many new comments can eat the 60s budget.
      // AUTO_REPLY_PUBLISH=false parks drafts for manual approval instead of posting them.
      const autoReply = process.env.AUTO_REPLY_PUBLISH === "false"
        ? null
        : await publishDueDraftReplies(brand.id, credentials);
      const scanResult = await scanAndDraftRepliesForBrand(brand.id, credentials, {
        creatorHandle: brandConfig.creatorHandle,
        language,
      });

      results.push({ ...scanResult, autoReply });
    } catch (err) {
      console.error(`[cron/replies] Brand ${brand.name} scan failed:`, err);
      results.push({
        brandId: brand.id,
        error: err instanceof Error ? err.message : "Scan failed",
      });
    }
  }

  return NextResponse.json({ success: true, results });
}
