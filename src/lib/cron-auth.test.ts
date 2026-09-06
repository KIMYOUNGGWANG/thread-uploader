import { describe, expect, it, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { verifyCronSecret } from "./cron-auth";

describe("verifyCronSecret", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  it("fails closed in production if CRON_SECRET is missing", () => {
    (process.env as any).NODE_ENV = "production";
    delete process.env.CRON_SECRET;

    const req = new NextRequest("http://localhost/api/cron/publish");
    expect(verifyCronSecret(req)).toBe(false);
  });

  it("allows non-production when CRON_SECRET is intentionally unset", () => {
    (process.env as any).NODE_ENV = "development";
    delete process.env.CRON_SECRET;

    const req = new NextRequest("http://localhost/api/cron/publish");
    expect(verifyCronSecret(req)).toBe(true);
  });

  it("validates Bearer token in authorization header", () => {
    process.env.CRON_SECRET = "top_secret_cron";

    const validReq = new NextRequest("http://localhost/api/cron/publish", {
      headers: { authorization: "Bearer top_secret_cron" },
    });
    expect(verifyCronSecret(validReq)).toBe(true);

    const invalidReq = new NextRequest("http://localhost/api/cron/publish", {
      headers: { authorization: "Bearer wrong_token" },
    });
    expect(verifyCronSecret(invalidReq)).toBe(false);
  });

  it("validates secret query parameter", () => {
    process.env.CRON_SECRET = "top_secret_cron";

    const validReq = new NextRequest("http://localhost/api/cron/publish?secret=top_secret_cron");
    expect(verifyCronSecret(validReq)).toBe(true);

    const invalidReq = new NextRequest("http://localhost/api/cron/publish?secret=wrong");
    expect(verifyCronSecret(invalidReq)).toBe(false);
  });
});
