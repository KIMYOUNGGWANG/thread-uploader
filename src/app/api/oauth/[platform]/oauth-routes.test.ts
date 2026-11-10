import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  requireBrand: vi.fn(),
  save: vi.fn(),
  exchange: vi.fn(),
  profile: vi.fn(),
}));

vi.mock("@/lib/brand-access", () => ({
  requireBrandForCurrentUser: mocks.requireBrand,
  accessErrorResponse: () => null,
}));
vi.mock("@/lib/distribution/accounts", () => ({ saveConnectedAccount: mocks.save }));
vi.mock("@/lib/distribution/oauth-providers", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/distribution/oauth-providers")>();
  return {
    ...actual,
    OAUTH_PROVIDERS: {
      ...actual.OAUTH_PROVIDERS,
      x: { ...actual.OAUTH_PROVIDERS.x, exchangeCode: mocks.exchange, profile: mocks.profile },
    },
  };
});

import { GET as start } from "./start/route";
import { GET as callback } from "./callback/route";

const params = (platform: string) => ({ params: Promise.resolve({ platform }) });

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  vi.stubEnv("X_CLIENT_ID", "cid");
  vi.stubEnv("X_CLIENT_SECRET", "secret");
  mocks.requireBrand.mockResolvedValue({ brand: { id: "b1", slug: "cosmicpath" } });
});

describe("OAuth start", () => {
  it("404s unknown platforms", async () => {
    const res = await start(new NextRequest("http://localhost/api/oauth/myspace/start?brandId=b1"), params("myspace"));
    expect(res.status).toBe(404);
  });

  it("explains missing app keys", async () => {
    vi.stubEnv("YOUTUBE_CLIENT_ID", "");
    const res = await start(new NextRequest("http://localhost/api/oauth/youtube/start?brandId=b1"), params("youtube"));
    expect(res.status).toBe(500);
    expect((await res.json()).error).toContain("YOUTUBE_CLIENT_ID");
  });

  it("redirects to X with PKCE and remembers state + verifier in a cookie", async () => {
    const res = await start(new NextRequest("http://localhost/api/oauth/x/start?brandId=b1"), params("x"));
    const location = new URL(res.headers.get("location") ?? "");
    expect(location.origin).toBe("https://x.com");
    expect(location.searchParams.get("code_challenge_method")).toBe("S256");
    expect(location.searchParams.get("redirect_uri")).toBe("http://localhost/api/oauth/x/callback");
    const [brandId, state, verifier] = (res.cookies.get("x_oauth")?.value ?? "").split(":");
    expect(brandId).toBe("b1");
    expect(state).toBe(location.searchParams.get("state"));
    expect(verifier.length).toBeGreaterThan(20);
  });
});

describe("OAuth callback", () => {
  const request = (query: string, cookie?: string) =>
    new NextRequest(`http://localhost/api/oauth/x/callback${query}`, { headers: cookie ? { cookie: `x_oauth=${cookie}` } : {} });

  it("rejects a state mismatch", async () => {
    const res = await callback(request("?code=c&state=other", "b1:s1:v1"), params("x"));
    expect(res.status).toBe(400);
    expect(mocks.exchange).not.toHaveBeenCalled();
  });

  it("exchanges the code with the stored verifier and saves the account", async () => {
    const tokens = { accessToken: "a", refreshToken: "r", expiresAt: new Date() };
    mocks.exchange.mockResolvedValueOnce(tokens);
    mocks.profile.mockResolvedValueOnce({ externalUserId: "42", handle: "brand" });
    const res = await callback(request("?code=c&state=s1", "b1:s1:v1"), params("x"));
    expect(mocks.exchange).toHaveBeenCalledWith(
      { clientId: "cid", clientSecret: "secret" },
      { code: "c", redirectUri: "http://localhost/api/oauth/x/callback", codeVerifier: "v1" },
      expect.any(Date),
    );
    expect(mocks.save).toHaveBeenCalledWith("b1", "x", { externalUserId: "42", handle: "brand" }, tokens);
    expect(res.headers.get("location")).toBe("http://localhost/brands/cosmicpath/settings?x=connected");
  });

  it("redirects with a failure flag when the exchange fails", async () => {
    mocks.exchange.mockRejectedValueOnce(new Error("invalid_grant"));
    const res = await callback(request("?code=c&state=s1", "b1:s1:v1"), params("x"));
    expect(res.headers.get("location")).toBe("http://localhost/brands?x=connection_failed");
    expect(mocks.save).not.toHaveBeenCalled();
  });
});
