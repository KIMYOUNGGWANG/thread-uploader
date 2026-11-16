import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  update: vi.fn(async () => ({})),
  refresh: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: { channelAccount: { findUnique: mocks.findUnique, update: mocks.update } } }));
vi.mock("@/lib/crypto", () => ({
  decryptToken: (value: string) => value.replace(/^enc:/, ""),
  encrypt: (value: string) => `enc:${value}`,
}));
vi.mock("@/lib/instagram-api", () => ({ getFreshInstagramCredentials: vi.fn() }));
vi.mock("@/lib/channels/publication-mirror", () => ({ ensureLegacyChannelAccount: vi.fn() }));
vi.mock("./oauth-providers", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./oauth-providers")>();
  return {
    ...actual,
    readAppCredentials: () => ({ clientId: "id", clientSecret: "secret" }),
    OAUTH_PROVIDERS: { x: { label: "X", refresh: mocks.refresh } },
  };
});

import { getChannelCredentials } from "./accounts";
import { ChannelApiError } from "./http";

const NOW = new Date("2026-11-16T00:00:00Z");
const expired = new Date(NOW.getTime() - 60_000);
const fresh = new Date(NOW.getTime() + 60 * 60_000);

// Rows from one runDueUploads query each carry their own snapshot of the account.
const account = (over: Record<string, unknown> = {}) =>
  ({ id: "a1", brandId: "b1", platform: "x", accessToken: "enc:old-access", refreshToken: "enc:r1", tokenExpiry: expired, externalUserId: "u1", handle: "h", ...over }) as never;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.findUnique.mockResolvedValue(null);
});

describe("getChannelCredentials", () => {
  // Two uploads for one account in the same run: the first refresh rotates the tokens, the second row still
  // holds the old snapshot. Refreshing again with the old refresh token can fail with invalid_grant.
  it("uses tokens another upload already refreshed instead of refreshing again from a stale snapshot", async () => {
    mocks.findUnique.mockResolvedValue(account({ accessToken: "enc:new-access", tokenExpiry: fresh }));

    const creds = await getChannelCredentials(account(), NOW);

    expect(creds.accessToken).toBe("new-access");
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it("refreshes with the stored refresh token, not the one in the stale snapshot", async () => {
    mocks.findUnique.mockResolvedValue(account({ refreshToken: "enc:r2" }));
    mocks.refresh.mockResolvedValue({ accessToken: "fresh-access", refreshToken: "r3", expiresAt: fresh });

    const creds = await getChannelCredentials(account(), NOW);

    expect(mocks.refresh).toHaveBeenCalledWith(expect.anything(), "r2", NOW);
    expect(creds.accessToken).toBe("fresh-access");
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ accessToken: "enc:fresh-access", refreshToken: "enc:r3" }),
    }));
  });

  describe("when the token refresh fails", () => {
    beforeEach(() => mocks.findUnique.mockResolvedValue(account()));

    it("asks for a reconnect only when the platform rejects the grant", async () => {
      mocks.refresh.mockRejectedValue(new ChannelApiError("X token refresh: invalid_grant (HTTP 400)", 400, true));

      const error = await getChannelCredentials(account(), NOW).catch((e: unknown) => e);

      expect(error).toBeInstanceOf(ChannelApiError);
      expect(error).toMatchObject({ permanent: true, status: 400 });
      expect((error as Error).message).toContain("reconnect needed");
    });

    it("keeps a platform outage retryable instead of failing the upload for good", async () => {
      mocks.refresh.mockRejectedValue(new ChannelApiError("X token refresh: Service Unavailable (HTTP 503)", 503, false));

      const error = await getChannelCredentials(account(), NOW).catch((e: unknown) => e);

      expect(error).toBeInstanceOf(ChannelApiError);
      expect(error).toMatchObject({ permanent: false, status: 503 });
      expect((error as Error).message).not.toContain("reconnect needed");
    });

    it("keeps a timeout or network error retryable", async () => {
      mocks.refresh.mockRejectedValue(new DOMException("The operation was aborted due to timeout", "TimeoutError"));

      const error = await getChannelCredentials(account(), NOW).catch((e: unknown) => e);

      expect(error).toBeInstanceOf(ChannelApiError);
      expect(error).toMatchObject({ permanent: false });
      expect((error as Error).message).not.toContain("reconnect needed");
    });
  });
});
