import { NextRequest, NextResponse } from "next/server";
import { verifyCronSecret } from "@/lib/cron-auth";
import { completeDraft, type CompleteInput } from "@/lib/video-factory/draft-service";

const isHttps = (v: unknown): v is string => typeof v === "string" && /^https:\/\//.test(v);

function parseBody(body: unknown): CompleteInput | null {
  if (typeof body !== "object" || body === null) return null;
  const { draftId, videoUrl, coverUrl, errors } = body as Record<string, unknown>;
  if (typeof draftId !== "string" || !draftId) return null;
  if (errors === undefined) {
    return isHttps(videoUrl) && isHttps(coverUrl) ? { draftId, videoUrl, coverUrl } : null;
  }
  if (videoUrl !== undefined || coverUrl !== undefined) return null;
  return Array.isArray(errors) && errors.length > 0 && errors.every((e) => typeof e === "string")
    ? { draftId, errors: errors as string[] }
    : null;
}

/**
 * POST /api/cron/video-factory/complete  { draftId, videoUrl, coverUrl } | { draftId, errors }
 * Records the CI render result on a RENDERING draft.
 */
export async function POST(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const input = parseBody(await request.json().catch(() => null));
  if (!input) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const result = await completeDraft(input);
  if (result === "not_found") return NextResponse.json({ error: "Draft not found" }, { status: 404 });
  if (result === "conflict") return NextResponse.json({ error: "Draft is not being rendered" }, { status: 409 });
  return NextResponse.json({ ok: true });
}
