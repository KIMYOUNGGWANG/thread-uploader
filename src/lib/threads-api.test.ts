import { describe, expect, it, vi } from "vitest";

process.env.ENCRYPTION_KEY = "test-encryption-key";

vi.mock("@/lib/prisma", () => ({ prisma: { brand: { findUnique: vi.fn() } } }));

import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/crypto";
import { getFreshBrandCredentials } from "./threads-api";

describe("getFreshBrandCredentials", () => {
  it("decrypts the stored token so callers get the real Threads token", async () => {
    vi.mocked(prisma.brand.findUnique).mockResolvedValue({
      accessToken: encrypt("THQAA-real"),
      threadsUserId: "u1",
      tokenExpiry: new Date(Date.now() + 50 * 24 * 60 * 60 * 1000),
    } as never);

    expect(await getFreshBrandCredentials("b1")).toEqual({ accessToken: "THQAA-real", userId: "u1" });
  });
});
