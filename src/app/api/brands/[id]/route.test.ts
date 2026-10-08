import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

process.env.ENCRYPTION_KEY = "test-encryption-key";

const stored = { id: "b1", ownerId: "u1", name: "C", slug: "c", brandConfig: "{}", accessToken: "enc-old", formulaWeights: "{}", tokenExpiry: null, createdAt: new Date(), updatedAt: new Date() };

vi.mock("@/lib/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth")>();
  return { ...actual, requireAuth: vi.fn(async () => ({ id: "u1", email: "o@example.com", name: null })) };
});
vi.mock("@/lib/prisma", () => ({
  prisma: { brand: { findUnique: vi.fn(async () => stored), update: vi.fn(async (args?: { data?: Record<string, unknown> }) => ({ ...stored, ...args?.data })) } },
}));

import { prisma } from "@/lib/prisma";
import { decryptToken } from "@/lib/crypto";
import { PATCH } from "./route";

function patch(body: Record<string, unknown>) {
  return PATCH(
    new NextRequest("http://localhost/api/brands/b1", { method: "PATCH", body: JSON.stringify(body) }),
    { params: Promise.resolve({ id: "b1" }) }
  );
}

describe("PATCH /api/brands/[id] access token", () => {
  beforeEach(() => vi.mocked(prisma.brand.update).mockClear());

  it("keeps the stored token when the settings form sends an empty one", async () => {
    await patch({ name: "CosmicPath", accessToken: "" });
    const { data } = vi.mocked(prisma.brand.update).mock.calls[0][0];
    expect(data).not.toHaveProperty("accessToken");
  });

  it("encrypts a newly entered token before storing it", async () => {
    await patch({ accessToken: "THQAA-new" });
    const { data } = vi.mocked(prisma.brand.update).mock.calls[0][0];
    expect(data.accessToken).not.toBe("THQAA-new");
    expect(decryptToken(String(data.accessToken))).toBe("THQAA-new");
  });
});
