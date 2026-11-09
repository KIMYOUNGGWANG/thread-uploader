import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { accessErrorResponse, requireBrandForCurrentUser } from "@/lib/brand-access";
import { OAUTH_PROVIDERS, createPkcePair, isOAuthPlatform, readAppCredentials } from "@/lib/distribution/oauth-providers";

const OAUTH_COOKIE_MAX_AGE = 10 * 60;

/** GET /api/oauth/{youtube|tiktok|x}/start?brandId= — sends the owner to the platform's consent screen. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ platform: string }> }) {
  const { platform } = await params;
  if (!isOAuthPlatform(platform)) return NextResponse.json({ error: "Unknown platform" }, { status: 404 });
  try {
    const brandId = request.nextUrl.searchParams.get("brandId");
    if (!brandId) return NextResponse.json({ error: "brandId is required" }, { status: 400 });

    const spec = OAUTH_PROVIDERS[platform];
    const app = readAppCredentials(platform);
    if (!app) return NextResponse.json({ error: `${spec.envId}/${spec.envSecret} is not configured` }, { status: 500 });

    await requireBrandForCurrentUser(brandId);

    const state = randomUUID();
    const pkce = spec.usesPkce ? createPkcePair() : null;
    const redirectUri = new URL(`/api/oauth/${platform}/callback`, request.url).toString();
    const response = NextResponse.redirect(spec.authorizeUrl({ clientId: app.clientId, redirectUri, state, codeChallenge: pkce?.challenge ?? null }));
    response.cookies.set(`${platform}_oauth`, [brandId, state, pkce?.verifier ?? ""].join(":"), {
      httpOnly: true,
      maxAge: OAUTH_COOKIE_MAX_AGE,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    });
    return response;
  } catch (error) {
    const response = accessErrorResponse(error);
    if (response) return response;
    return NextResponse.json({ error: "Connection could not be started" }, { status: 500 });
  }
}
