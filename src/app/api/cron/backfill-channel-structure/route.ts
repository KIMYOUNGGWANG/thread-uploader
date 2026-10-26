import { NextRequest, NextResponse } from "next/server";
import { verifyCronSecret } from "@/lib/cron-auth";
import { runChannelBackfill } from "@/lib/channels/backfill";

export const maxDuration = 300;

// ponytail: one-off backfill route; delete in the legacy-column cleanup phase
/** Dry-run by default; pass ?apply=1 to write. Idempotent. */
export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const apply = request.nextUrl.searchParams.get("apply") === "1";
  try {
    return NextResponse.json(await runChannelBackfill({ apply }));
  } catch (error: unknown) {
    console.error("[backfill-channel-structure]", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
