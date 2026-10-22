import { NextRequest, NextResponse } from "next/server";
import { verifyCronSecret } from "@/lib/cron-auth";
import { cleanupShorts, snapshotShorts } from "@/lib/youtube/shorts-service";

export const maxDuration = 300;

export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const snapshot = await snapshotShorts();
  const cleanup = await cleanupShorts();
  // Single pseudo-brand row "*" keeps the response shape the same as discover.
  return NextResponse.json({
    success: true,
    brands: [{ slug: "*", snapshots: snapshot.snapshots, deleted: cleanup.deleted, quotaUsed: snapshot.quotaUsed, errors: snapshot.errors }],
  });
}
