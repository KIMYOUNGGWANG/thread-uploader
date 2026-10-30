import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyCronSecret } from "@/lib/cron-auth";
import { claimOrCreateDraft, requeueStaleRenders } from "@/lib/video-factory/draft-service";

export const maxDuration = 300; // up to 3 Claude attempts (30s timeout, 1 retry each) must finish so a FAILED draft gets recorded

/**
 * GET /api/cron/video-factory/next?brands=slug[&force=1]
 * Hands the CI renderer today's kinetic-list job (claimed as RENDERING), or { job: null }.
 */
export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = request.nextUrl.searchParams;
  const slugs = params.get("brands")?.split(",").map((slug) => slug.trim()).filter(Boolean);
  if (!slugs?.length) {
    return NextResponse.json({ error: "brands query is required" }, { status: 400 });
  }
  const force = params.get("force") === "1";

  const now = new Date();
  await requeueStaleRenders(now);

  const brands = await prisma.brand.findMany({
    where: { slug: { in: slugs } },
    select: { id: true, slug: true, name: true, brandConfig: true },
  });
  for (const brand of brands) {
    const job = await claimOrCreateDraft(brand, now, force);
    if (job) return NextResponse.json({ job });
  }
  return NextResponse.json({ job: null });
}
