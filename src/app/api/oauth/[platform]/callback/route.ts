import { NextRequest, NextResponse } from "next/server";
import { accessErrorResponse, requireBrandForCurrentUser } from "@/lib/brand-access";
import { saveConnectedAccount } from "@/lib/distribution/accounts";
import { OAUTH_PROVIDERS, isOAuthPlatform, readAppCredentials } from "@/lib/distribution/oauth-providers";

function parseCookie(value: string | undefined): { brandId: string; state: string; verifier: string | null } | null {
  const [brandId, state, verifier] = (value ?? "").split(":");
  return brandId && state ? { brandId, state, verifier: verifier || null } : null;
}

/** GET /api/oauth/{youtube|tiktok|x}/callback — stores encrypted tokens on the brand's ChannelAccount. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ platform: string }> }) {
  const { platform } = await params;
  if (!isOAuthPlatform(platform)) return NextResponse.json({ error: "Unknown platform" }, { status: 404 });
  const cookieName = `${platform}_oauth`;
  const clear = (response: NextResponse) => {
    response.cookies.delete(cookieName);
    return response;
  };

  const search = request.nextUrl.searchParams;
  const stored = parseCookie(request.cookies.get(cookieName)?.value);
  const code = search.get("code");
  if (!stored || !code || search.get("state") !== stored.state) {
    return clear(NextResponse.json({ error: `Invalid ${OAUTH_PROVIDERS[platform].label} OAuth state` }, { status: 400 }));
  }
  const app = readAppCredentials(platform);
  if (!app) return clear(NextResponse.json({ error: "App credentials are not configured" }, { status: 500 }));

  let stage = "access";
  try {
    const { brand } = await requireBrandForCurrentUser(stored.brandId);
    const spec = OAUTH_PROVIDERS[platform];
    const redirectUri = new URL(`/api/oauth/${platform}/callback`, request.url).toString();
    stage = "token";
    const tokens = await spec.exchangeCode(app, { code, redirectUri, codeVerifier: stored.verifier }, new Date());
    stage = "profile";
    const profile = await spec.profile(tokens.accessToken);
    stage = "save";
    await saveConnectedAccount(brand.id, platform, profile, tokens);
    return clear(NextResponse.redirect(new URL(`/brands/${brand.slug}/settings?${platform}=connected`, request.url)));
  } catch (error) {
    const response = accessErrorResponse(error);
    if (response) return clear(response);
    // Message only: never log the code or tokens.
    console.error(`[${platform}-oauth] callback failed at ${stage}:`, error instanceof Error ? error.message : "Unknown error");
    return clear(NextResponse.redirect(new URL(`/brands?${platform}=connection_failed`, request.url)));
  }
}
