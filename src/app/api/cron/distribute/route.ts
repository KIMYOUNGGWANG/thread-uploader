import { NextRequest, NextResponse } from "next/server";
import { verifyCronSecret } from "@/lib/cron-auth";
import { scheduleUploads } from "@/lib/distribution/scheduler";
import { runDueUploads } from "@/lib/distribution/runner";

export const maxDuration = 300;

/**
 * GET /api/cron/distribute[?brands=slug1,slug2][&schedule=false]
 * Queues uploads whose cancel window closed (videos → YouTube/Instagram/TikTok, card news → Instagram,
 * published Threads posts → X), then runs every due upload within the time budget.
 */
export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const params = request.nextUrl.searchParams;
  const slugs = params.get("brands")?.split(",").map((s) => s.trim()).filter(Boolean);
  const now = new Date();
  try {
    const scheduled = params.get("schedule") === "false" ? null : await scheduleUploads(now, slugs);
    const run = await runDueUploads(now);
    return NextResponse.json({ ok: true, scheduled, run });
  } catch (error) {
    console.error("[distribute] failed:", error instanceof Error ? error.message : error);
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
