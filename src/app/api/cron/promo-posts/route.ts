import { NextRequest, NextResponse } from "next/server";
import { verifyCronSecret } from "@/lib/cron-auth";
import { parsePromoPostsBody, queuePromoPosts } from "@/lib/promo/promo-post-service";

/**
 * POST /api/cron/promo-posts  { date, items: PromoPostItem[] }
 * Called by the CI promo renderer after uploading videos. Each item becomes one NEEDS_REVIEW
 * Threads video post per brand and date; the operator approves it before it is published.
 */
export async function POST(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON" }, { status: 400 });
  }
  const parsed = parsePromoPostsBody(body);
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  return NextResponse.json({ results: await queuePromoPosts(parsed.date, parsed.items) });
}
