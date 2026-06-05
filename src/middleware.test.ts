import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "@/middleware";

describe("middleware public routes", () => {
  it("allows product auto-setup previews without a session", () => {
    const response = middleware(new NextRequest("http://localhost/api/products/auto-setup"));

    expect(response.status).toBe(200);
  });

  it("keeps stored brand APIs protected without a session", () => {
    const response = middleware(new NextRequest("http://localhost/api/brands"));

    expect(response.status).toBe(401);
  });
});
