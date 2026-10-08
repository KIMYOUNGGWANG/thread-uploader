import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: { user: { findUnique: vi.fn(), create: vi.fn() } } }));

import { POST } from "./route";

describe("POST /api/auth/register", () => {
  it("is closed unless ALLOW_REGISTRATION=true", async () => {
    delete process.env.ALLOW_REGISTRATION;
    const response = await POST(new Request("http://localhost/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ email: "admin@example.com", password: "password123" }),
    }));
    expect(response.status).toBe(403);
  });
});
