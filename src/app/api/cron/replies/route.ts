import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getFreshBrandCredentials } from "@/lib/threads-api";
import { verifyCronSecret } from "@/lib/cron-auth";
import { scanAndDraftRepliesForBrand } from "@/lib/threads/reply-mention-engine";
import { parseBrandConfig } from "@/types/brand";

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const brands = await prisma.brand.findMany();
  if (brands.length === 0) {
    return NextResponse.json({ message: "No brands found", results: [] });
  }

  const results = [];

  for (const brand of brands) {
    try {
      const brandConfig = parseBrandConfig(brand.brandConfig || "{}");

      const credentials = await getFreshBrandCredentials(brand.id);
      const scanResult = await scanAndDraftRepliesForBrand(brand.id, credentials, {
        creatorHandle: brandConfig.creatorHandle,
      });

      results.push(scanResult);
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
