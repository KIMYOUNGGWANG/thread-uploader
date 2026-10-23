import { NextRequest, NextResponse } from "next/server";
import { verifyCronSecret } from "@/lib/cron-auth";
import { cleanupShorts, snapshotShorts } from "@/lib/youtube/shorts-service";

export const maxDuration = 300;

async function runSnapshot() {
  try {
    return await snapshotShorts();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Shorts snapshot failed";
    return { snapshots: 0, quotaUsed: 0, errors: [{ adapter: "youtube_shorts", source: "route", message }] };
  }
}

export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const snapshot = await runSnapshot();
  // Cleanup must run even when snapshotting fails: 7-day retention is a YouTube API terms requirement.
  const cleanup = await cleanupShorts();
  // Single pseudo-brand row "*" keeps the response shape the same as discover.
  return NextResponse.json({
    success: true,
    brands: [{ slug: "*", snapshots: snapshot.snapshots, deleted: cleanup.deleted, quotaUsed: snapshot.quotaUsed, errors: snapshot.errors }],
  });
}
