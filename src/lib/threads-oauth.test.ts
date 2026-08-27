import { describe, expect, it } from "vitest";
import { buildThreadsAuthorizationUrl } from "@/lib/threads-oauth";

describe("buildThreadsAuthorizationUrl", () => {
  it("includes the callback, state, and publishing permissions", () => {
    const url = new URL(buildThreadsAuthorizationUrl({
      appId: "2440826109698658",
      redirectUri: "https://thread-uploader.vercel.app/api/oauth/threads/callback",
      state: "state_123",
    }));

    expect(url.origin).toBe("https://threads.net");
    expect(url.pathname).toBe("/oauth/authorize");
    expect(url.searchParams.get("client_id")).toBe("2440826109698658");
    expect(url.searchParams.get("redirect_uri")).toBe("https://thread-uploader.vercel.app/api/oauth/threads/callback");
    expect(url.searchParams.get("state")).toBe("state_123");
    expect(url.searchParams.get("scope")).toBe("threads_basic,threads_content_publish");
  });
});
