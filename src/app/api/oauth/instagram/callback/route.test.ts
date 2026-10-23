import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  update: vi.fn(),
  ensureAnchor: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: { brand: { update: mocks.update } } }));
vi.mock("@/lib/crypto", () => ({ encrypt: (value: string) => `enc(${value})` }));
vi.mock("@/lib/brand-access", () => ({
  accessErrorResponse: () => null,
  requireBrandForCurrentUser: vi.fn(async () => ({
    brand: { id: "b1", slug: "cosmic", instagramConnectedAt: null },
  })),
}));
vi.mock("@/lib/instagram-bio-anchor", () => ({ ensureInstagramBioAnchor: mocks.ensureAnchor }));
vi.mock("@/lib/instagram-oauth", () => ({
  exchangeInstagramAuthorizationCode: vi.fn(async () => "short"),
  exchangeInstagramLongLivedToken: vi.fn(async () => ({ accessToken: "long", expiresIn: 3600 })),
  getInstagramProfile: vi.fn(async () => ({ userId: "ig1", username: "cosmic" })),
}));

import { GET } from "@/app/api/oauth/instagram/callback/route";

function callbackRequest(query: string, cookie = "b1:good") {
  return new NextRequest(`https://app.test/api/oauth/instagram/callback?${query}`, {
    headers: { cookie: `instagram_oauth=${cookie}` },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("INSTAGRAM_APP_ID", "app");
  vi.stubEnv("INSTAGRAM_APP_SECRET", "secret");
});

describe("instagram oauth callback", () => {
  it("stores encrypted token, profile, connectedAt and redirects to settings?instagram=connected", async () => {
    const response = await GET(callbackRequest("state=good&code=c"));

    const data = mocks.update.mock.calls[0]?.[0].data;
    expect(data.instagramAccessToken).toBe("enc(long)");
    expect(data.instagramUserId).toBe("ig1");
    expect(data.instagramUsername).toBe("cosmic");
    expect(data.instagramTokenExpiry).toBeInstanceOf(Date);
    expect(data.instagramConnectedAt).toBeInstanceOf(Date);
    expect(mocks.ensureAnchor).toHaveBeenCalledWith("b1");
    expect(response.headers.get("location")).toBe("https://app.test/brands/cosmic/settings?instagram=connected");
  });

  it("returns 400 on state mismatch", async () => {
    const response = await GET(callbackRequest("state=evil&code=c"));
    expect(response.status).toBe(400);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("returns 500 JSON when app credentials are missing", async () => {
    vi.stubEnv("INSTAGRAM_APP_SECRET", "");
    const response = await GET(callbackRequest("state=good&code=c"));
    expect(response.status).toBe(500);
  });

  it("logs the failure stage and message without the code or secret, then redirects to connection_failed", async () => {
    const { exchangeInstagramLongLivedToken } = await import("@/lib/instagram-oauth");
    vi.mocked(exchangeInstagramLongLivedToken).mockRejectedValueOnce(new Error("Session has expired"));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const response = await GET(callbackRequest("state=good&code=secret-code"));

    expect(response.headers.get("location")).toBe("https://app.test/brands?instagram=connection_failed");
    expect(consoleError).toHaveBeenCalledTimes(1);
    const logged = consoleError.mock.calls[0]?.map(String).join(" ") ?? "";
    expect(logged).toContain("connect");
    expect(logged).toContain("Session has expired");
    expect(logged).not.toContain("secret-code");
    expect(logged).not.toContain("secret");
    consoleError.mockRestore();
  });
});
