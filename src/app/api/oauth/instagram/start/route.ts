import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { accessErrorResponse, requireBrandForCurrentUser } from "@/lib/brand-access";
import { buildInstagramAuthorizationUrl } from "@/lib/instagram-oauth";

const OAUTH_COOKIE_NAME = "instagram_oauth";

export async function GET(request: NextRequest) {
  try {
    const brandId = request.nextUrl.searchParams.get("brandId");
    if (!brandId) return NextResponse.json({ error: "brandId is required" }, { status: 400 });

    const appId = process.env.INSTAGRAM_APP_ID;
    if (!appId) return NextResponse.json({ error: "INSTAGRAM_APP_ID is not configured" }, { status: 500 });

    await requireBrandForCurrentUser(brandId);

    const state = randomUUID();
    const redirectUri = new URL("/api/oauth/instagram/callback", request.url).toString();
    const response = NextResponse.redirect(buildInstagramAuthorizationUrl({ appId, redirectUri, state }));
    response.cookies.set(OAUTH_COOKIE_NAME, `${brandId}:${state}`, {
      httpOnly: true,
      maxAge: 10 * 60,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    });
    return response;
  } catch (error) {
    const response = accessErrorResponse(error);
    if (response) return response;
    return NextResponse.json({ error: "Instagram connection could not be started" }, { status: 500 });
  }
}
