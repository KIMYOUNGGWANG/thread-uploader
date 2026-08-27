import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { accessErrorResponse, requireBrandForCurrentUser } from "@/lib/brand-access";
import {
  exchangeThreadsAuthorizationCode,
  exchangeThreadsLongLivedToken,
  getThreadsUserId,
  THREADS_APP_ID,
} from "@/lib/threads-oauth";

const OAUTH_COOKIE_NAME = "threads_oauth";

export async function GET(request: NextRequest) {
  const callbackState = request.nextUrl.searchParams.get("state");
  const code = request.nextUrl.searchParams.get("code");
  const cookieValue = request.cookies.get(OAUTH_COOKIE_NAME)?.value;
  const storedState = parseStoredState(cookieValue);

  if (!callbackState || !code || !storedState || storedState.state !== callbackState) {
    return NextResponse.json({ error: "Invalid Threads OAuth state" }, { status: 400 });
  }

  try {
    const { brand } = await requireBrandForCurrentUser(storedState.brandId);
    const appSecret = process.env.THREADS_APP_SECRET;
    if (!appSecret) return NextResponse.json({ error: "THREADS_APP_SECRET is not configured" }, { status: 500 });

    const redirectUri = new URL("/api/oauth/threads/callback", request.url).toString();
    const shortLivedToken = await exchangeThreadsAuthorizationCode({
      appId: THREADS_APP_ID,
      appSecret,
      code,
      redirectUri,
    });
    const longLivedToken = await exchangeThreadsLongLivedToken({
      appSecret,
      shortLivedToken,
    });
    const threadsUserId = await getThreadsUserId(longLivedToken.accessToken);
    const tokenExpiry = new Date(Date.now() + longLivedToken.expiresIn * 1_000);

    await prisma.brand.update({
      where: { id: brand.id },
      data: {
        accessToken: longLivedToken.accessToken,
        threadsUserId,
        tokenExpiry,
      },
    });

    return clearOAuthCookie(
      NextResponse.redirect(new URL(`/brands/${brand.slug}/settings?threads=connected`, request.url))
    );
  } catch (error) {
    const response = accessErrorResponse(error);
    if (response) return clearOAuthCookie(response);
    return clearOAuthCookie(
      NextResponse.redirect(new URL("/brands?threads=connection_failed", request.url))
    );
  }
}

function parseStoredState(value: string | undefined): { readonly brandId: string; readonly state: string } | null {
  if (!value) return null;
  const separatorIndex = value.indexOf(":");
  if (separatorIndex <= 0) return null;
  const brandId = value.slice(0, separatorIndex);
  const state = value.slice(separatorIndex + 1);
  return brandId && state ? { brandId, state } : null;
}

function clearOAuthCookie(response: NextResponse): NextResponse {
  response.cookies.delete(OAUTH_COOKIE_NAME);
  return response;
}
