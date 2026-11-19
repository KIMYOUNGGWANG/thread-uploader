import { NextRequest, NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { accessErrorResponse, requireBrandForCurrentUser } from "@/lib/brand-access";

const MAX_BYTES = 5 * 1024 * 1024; // Telegram fetches photos by URL up to 5 MB

function brandIdOf(clientPayload: string | null): string | null {
  try {
    const parsed: unknown = JSON.parse(clientPayload ?? "null");
    return parsed && typeof parsed === "object" && "brandId" in parsed && typeof parsed.brandId === "string" ? parsed.brandId : null;
  } catch {
    return null;
  }
}

/**
 * POST /api/newsdesk/upload — issues a short-lived client token so the browser uploads straight to Vercel Blob
 * (no function body limit). Only the brand's owner, only PNG/JPEG up to 5 MB, only under newsdesk/<brandId>/,
 * with a random suffix so an approved image URL can never be overwritten.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as HandleUploadBody;
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const brandId = brandIdOf(clientPayload);
        if (!brandId) throw new Error("brandId가 필요해");
        await requireBrandForCurrentUser(brandId);
        if (!pathname.startsWith(`newsdesk/${brandId}/`)) throw new Error("업로드 경로가 맞지 않아");
        return { allowedContentTypes: ["image/png", "image/jpeg"], maximumSizeInBytes: MAX_BYTES, addRandomSuffix: true };
      },
      // No onUploadCompleted: the URL is saved when the operator edits the item, and without it
      // handleUpload sets no callbackUrl, so Vercel never calls this unauthenticated route back.
    });
    return NextResponse.json(result);
  } catch (error) {
    return accessErrorResponse(error) ?? NextResponse.json({ error: error instanceof Error ? error.message : "업로드 준비 실패" }, { status: 400 });
  }
}
