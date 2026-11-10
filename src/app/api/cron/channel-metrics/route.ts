import { NextRequest, NextResponse } from "next/server";
import { verifyCronSecret } from "@/lib/cron-auth";
import { collectChannelMetrics } from "@/lib/distribution/metrics";

export const maxDuration = 120;

/** GET /api/cron/channel-metrics — views/likes/comments for uploads published in the last 14 days. */
export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const report = await collectChannelMetrics(new Date());
  return NextResponse.json({ ok: true, ...report });
}
