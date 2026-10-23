import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildInstagramAuthorizationUrl,
  exchangeInstagramAuthorizationCode,
  exchangeInstagramLongLivedToken,
  getInstagramProfile,
  InstagramOAuthError,
  refreshInstagramLongLivedToken,
} from "@/lib/instagram-oauth";

function stubFetch(body: unknown, status = 200) {
  const fetchMock = vi.fn<typeof fetch>(async () => new Response(JSON.stringify(body), { status }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => vi.unstubAllGlobals());

describe("instagram oauth", () => {
  it("builds the authorize URL with publish scopes", () => {
    const url = new URL(buildInstagramAuthorizationUrl({ appId: "a", redirectUri: "https://x/cb", state: "s" }));
    expect(url.origin + url.pathname).toBe("https://www.instagram.com/oauth/authorize");
    expect(url.searchParams.get("scope")).toBe("instagram_business_basic,instagram_business_content_publish");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("client_id")).toBe("a");
    expect(url.searchParams.get("redirect_uri")).toBe("https://x/cb");
    expect(url.searchParams.get("state")).toBe("s");
  });

  it("exchanges code via form POST to api.instagram.com", async () => {
    const fetchMock = stubFetch({ access_token: "short" });
    const token = await exchangeInstagramAuthorizationCode({
      appId: "a", appSecret: "sec", code: "c", redirectUri: "https://x/cb",
    });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const body = new URLSearchParams(String(init.body));
    expect(token).toBe("short");
    expect(url).toBe("https://api.instagram.com/oauth/access_token");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe("application/x-www-form-urlencoded");
    expect(body.get("code")).toBe("c");
    expect(body.get("grant_type")).toBe("authorization_code");
    expect(body.get("client_secret")).toBe("sec");
  });

  it("exchanges long-lived token with grant_type=ig_exchange_token", async () => {
    const fetchMock = stubFetch({ access_token: "long", expires_in: 5184000 });
    const result = await exchangeInstagramLongLivedToken({ appSecret: "sec", shortLivedToken: "short" });
    const url = new URL(String(fetchMock.mock.calls[0]?.[0]));
    expect(result).toEqual({ accessToken: "long", expiresIn: 5184000 });
    expect(url.origin + url.pathname).toBe("https://graph.instagram.com/access_token");
    expect(url.searchParams.get("grant_type")).toBe("ig_exchange_token");
    expect(url.searchParams.get("access_token")).toBe("short");
  });

  it("refreshes with grant_type=ig_refresh_token", async () => {
    const fetchMock = stubFetch({ access_token: "newer", expires_in: 5184000 });
    const result = await refreshInstagramLongLivedToken("old");
    const url = new URL(String(fetchMock.mock.calls[0]?.[0]));
    expect(result).toEqual({ accessToken: "newer", expiresIn: 5184000 });
    expect(url.origin + url.pathname).toBe("https://graph.instagram.com/refresh_access_token");
    expect(url.searchParams.get("grant_type")).toBe("ig_refresh_token");
    expect(url.searchParams.get("access_token")).toBe("old");
  });

  it("reads user_id and username from /me", async () => {
    const fetchMock = stubFetch({ user_id: "123", username: "cosmic" });
    const profile = await getInstagramProfile("tok");
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const parsed = new URL(url);
    expect(profile).toEqual({ userId: "123", username: "cosmic" });
    expect(parsed.origin + parsed.pathname).toBe("https://graph.instagram.com/v26.0/me");
    expect(parsed.searchParams.get("fields")).toBe("user_id,username");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer tok");
  });

  it("throws InstagramOAuthError with the API message on error", async () => {
    stubFetch({ error: { message: "bad" } }, 400);
    const failure = getInstagramProfile("tok");
    await expect(failure).rejects.toBeInstanceOf(InstagramOAuthError);
    await expect(failure).rejects.toThrow("bad");
  });

  it("reads the top-level error_message shape from api.instagram.com", async () => {
    stubFetch({ error_type: "OAuthException", code: 400, error_message: "Invalid authorization code" }, 400);
    const failure = exchangeInstagramAuthorizationCode({ appId: "a", appSecret: "sec", code: "c", redirectUri: "https://x/cb" });
    await expect(failure).rejects.toThrow("Invalid authorization code");
  });
});
