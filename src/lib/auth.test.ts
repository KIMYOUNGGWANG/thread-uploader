import { describe, expect, it, vi, beforeEach } from "vitest";
import { createSessionToken, getSessionUserId, requireAuth, AuthError } from "./auth";
import { isSuperAdmin } from "./brand-access";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
  },
}));

describe("auth & session security", () => {
  const mockUser = {
    id: "user-cuid-1234",
    email: "test@example.com",
    name: "Test User",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("authenticates valid signed HMAC session token", async () => {
    const signedToken = createSessionToken(mockUser.id);
    vi.mocked(cookies).mockResolvedValue({
      get: vi.fn().mockReturnValue({ value: signedToken }),
    } as unknown as Awaited<ReturnType<typeof cookies>>);

    vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as unknown as Awaited<ReturnType<typeof prisma.user.findUnique>>);

    const user = await requireAuth();
    expect(user.id).toBe(mockUser.id);
    expect(user.email).toBe(mockUser.email);
  });

  it("rejects forged session token signatures with AuthError", async () => {
    const signedToken = createSessionToken(mockUser.id);
    const parts = signedToken.split(".");
    // Forged user id with legitimate signature
    const forgedToken = `attacker-user-id.${parts[1]}.${parts[2]}`;

    vi.mocked(cookies).mockResolvedValue({
      get: vi.fn().mockReturnValue({ value: forgedToken }),
    } as unknown as Awaited<ReturnType<typeof cookies>>);

    await expect(requireAuth()).rejects.toThrow(AuthError);
  });

  it("returns null from getSessionUserId when session cookie is missing or invalid", async () => {
    vi.mocked(cookies).mockResolvedValue({
      get: vi.fn().mockReturnValue(undefined),
    } as unknown as Awaited<ReturnType<typeof cookies>>);

    const userId = await getSessionUserId();
    expect(userId).toBeNull();
  });

  it("isSuperAdmin correctly identifies configured admin email", () => {
    process.env.SUPERADMIN_EMAIL = "super@company.com";
    expect(isSuperAdmin("super@company.com")).toBe(true);
    expect(isSuperAdmin("admin@example.com")).toBe(true); // default fallback
    expect(isSuperAdmin("other@company.com")).toBe(false);
    expect(isSuperAdmin(null)).toBe(false);
  });
});
