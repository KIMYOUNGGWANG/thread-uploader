import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";
import { signSession } from "@/lib/crypto";

process.env.ENCRYPTION_KEY = "test-encryption-key";

describe("proxy auth gate", () => {
  it("allows product auto-setup previews without a session", () => {
    const response = proxy(new NextRequest("http://localhost/api/products/auto-setup"));

    expect(response.status).toBe(200);
  });

  it("allows conversion webhooks without a session", () => {
    const response = proxy(new NextRequest("http://localhost/api/webhooks/conversion"));

    expect(response.status).toBe(200);
  });

  it("allows short link redirection without a session", () => {
    const response = proxy(new NextRequest("http://localhost/r/post-cuid-123"));

    expect(response.status).toBe(200);
  });

  it("allows visual cards API without a session", () => {
    const response = proxy(new NextRequest("http://localhost/api/cards/post-123"));

    expect(response.status).toBe(200);
  });

  it("allows attribution tracker script download without a session", () => {
    const response = proxy(new NextRequest("http://localhost/attribution-tracker.js"));

    expect(response.status).toBe(200);
  });

  it("keeps stored brand APIs protected without a session", () => {
    const response = proxy(new NextRequest("http://localhost/api/brands"));

    expect(response.status).toBe(401);
  });

  it("does not treat routes like /reports as public /r/ without a session", () => {
    const response = proxy(new NextRequest("http://localhost/reports"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost/login");
  });

  it("rejects arbitrary or unsigned session cookies", () => {
    for (const value of ["x", "user-cuid-1234", "user.123.deadbeef"]) {
      const request = new NextRequest("http://localhost/api/posts/upload");
      request.cookies.set("auth_session", value);
      expect(proxy(request).status).toBe(401);
    }
  });

  it("allows a validly signed session cookie", () => {
    const request = new NextRequest("http://localhost/api/brands");
    request.cookies.set("auth_session", signSession("user-cuid-1234"));
    expect(proxy(request).status).toBe(200);
  });
});
