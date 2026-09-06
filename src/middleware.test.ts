import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "@/middleware";

describe("middleware public routes", () => {
  it("allows product auto-setup previews without a session", () => {
    const response = middleware(new NextRequest("http://localhost/api/products/auto-setup"));

    expect(response.status).toBe(200);
  });

  it("allows conversion webhooks without a session", () => {
    const response = middleware(new NextRequest("http://localhost/api/webhooks/conversion"));

    expect(response.status).toBe(200);
  });

  it("allows short link redirection without a session", () => {
    const response = middleware(new NextRequest("http://localhost/r/post-cuid-123"));

    expect(response.status).toBe(200);
  });

  it("allows attribution tracker script download without a session", () => {
    const response = middleware(new NextRequest("http://localhost/attribution-tracker.js"));

    expect(response.status).toBe(200);
  });

  it("keeps stored brand APIs protected without a session", () => {
    const response = middleware(new NextRequest("http://localhost/api/brands"));

    expect(response.status).toBe(401);
  });

  it("does not treat routes like /reports as public /r/ without a session", () => {
    const response = middleware(new NextRequest("http://localhost/reports"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost/login");
  });
});
