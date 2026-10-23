import { NextRequest, NextResponse } from "next/server";
import { accessErrorResponse, requireBrandForCurrentUser } from "@/lib/brand-access";
import { encrypt } from "@/lib/crypto";
import { ensureInstagramBioAnchor } from "@/lib/instagram-bio-anchor";
import {
  exchangeInstagramAuthorizationCode,
  exchangeInstagramLongLivedToken,
  getInstagramProfile,
} from "@/lib/instagram-oauth";
import { prisma } from "@/lib/prisma";

const OAUTH_COOKIE_NAME = "instagram_oauth";

type AppCredentials = { readonly appId: string; readonly appSecret: string };

export async function GET(request: NextRequest) {
  const callbackState = request.nextUrl.searchParams.get("state");
  const code = request.nextUrl.searchParams.get("code");
  const storedState = parseStoredState(request.cookies.get(OAUTH_COOKIE_NAME)?.value);

  if (!callbackState || !code || !storedState || storedState.state !== callbackState) {
    return NextResponse.json({ error: "Invalid Instagram OAuth state" }, { status: 400 });
  }

  const credentials = readCredentials();
  if (!credentials) {
    return NextResponse.json({ error: "INSTAGRAM_APP_ID/INSTAGRAM_APP_SECRET is not configured" }, { status: 500 });
  }

  let stage = "access";
  try {
    const { brand } = await requireBrandForCurrentUser(storedState.brandId);
    const redirectUri = new URL("/api/oauth/instagram/callback", request.url).toString();
    stage = "connect";
    await connectBrand(brand, { ...credentials, code, redirectUri });
    stage = "bio_anchor";
    await ensureInstagramBioAnchor(brand.id);

    return clearOAuthCookie(
      NextResponse.redirect(new URL(`/brands/${brand.slug}/settings?instagram=connected`, request.url))
    );
  } catch (error) {
    const response = accessErrorResponse(error);
    if (response) return clearOAuthCookie(response);
    // Message only: never log the code, token, or app secret.
    console.error(`[instagram-oauth] callback failed at ${stage}:`, error instanceof Error ? error.message : "Unknown error");
    return clearOAuthCookie(
      NextResponse.redirect(new URL("/brands?instagram=connection_failed", request.url))
    );
  }
}

async function connectBrand(
  brand: { readonly id: string; readonly instagramConnectedAt: Date | null },
  input: AppCredentials & { readonly code: string; readonly redirectUri: string }
): Promise<void> {
  const shortLivedToken = await exchangeInstagramAuthorizationCode(input);
  const longLivedToken = await exchangeInstagramLongLivedToken({
    appSecret: input.appSecret,
    shortLivedToken,
  });
  const profile = await getInstagramProfile(longLivedToken.accessToken);

  await prisma.brand.update({
    where: { id: brand.id },
    data: {
      instagramAccessToken: encrypt(longLivedToken.accessToken),
      instagramUserId: profile.userId,
      instagramUsername: profile.username,
      instagramTokenExpiry: new Date(Date.now() + longLivedToken.expiresIn * 1_000),
      // Keep the first connection time so reconnecting never re-posts older Threads posts as reels.
      instagramConnectedAt: brand.instagramConnectedAt ?? new Date(),
    },
  });
}

function readCredentials(): AppCredentials | null {
  const appId = process.env.INSTAGRAM_APP_ID;
  const appSecret = process.env.INSTAGRAM_APP_SECRET;
  return appId && appSecret ? { appId, appSecret } : null;
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
