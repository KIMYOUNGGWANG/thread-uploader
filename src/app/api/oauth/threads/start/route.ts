import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { accessErrorResponse, requireBrandForCurrentUser } from "@/lib/brand-access";
import { buildThreadsAuthorizationUrl, THREADS_APP_ID } from "@/lib/threads-oauth";

const OAUTH_COOKIE_NAME = "threads_oauth";

export async function GET(request: NextRequest) {
  try {
    const brandId = request.nextUrl.searchParams.get("brandId");
    if (!brandId) return NextResponse.json({ error: "brandId is required" }, { status: 400 });

    await requireBrandForCurrentUser(brandId);

    const state = randomUUID();
    const redirectUri = new URL("/api/oauth/threads/callback", request.url).toString();
    const response = NextResponse.redirect(buildThreadsAuthorizationUrl({
      appId: THREADS_APP_ID,
      redirectUri,
      state,
    }));
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
    return NextResponse.json({ error: "Threads connection could not be started" }, { status: 500 });
  }
}
