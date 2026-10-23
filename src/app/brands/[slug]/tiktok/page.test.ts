import { beforeEach, describe, expect, it, vi } from "vitest";
import { getSessionUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import BrandTikTokPage from "./page";

vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

vi.mock("@/lib/auth", () => ({
  getSessionUserId: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    brand: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@/components/tiktok/TikTokStudioClient", () => ({
  TikTokStudioClient: () => null,
}));

const OWNER_ID = "user-owner";

function makeBrand(ownerId: string) {
  return {
    id: "brand-1",
    name: "CosmicPath",
    slug: "cosmicpath",
    accessToken: null,
    threadsUserId: null,
    tokenExpiry: null,
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    createdAt: new Date("2026-01-01T00:00:00Z"),
    formulaWeights: "{}",
    brandConfig: "{}",
    growthMemory: "{}",
    viralMemory: "{}",
    ownerId,
  };
}

function renderPage() {
  return BrandTikTokPage({ params: Promise.resolve({ slug: "cosmicpath" }) });
}

describe("BrandTikTokPage session check", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("resolves for the session user who owns the brand", async () => {
    vi.mocked(getSessionUserId).mockResolvedValue(OWNER_ID);
    vi.mocked(prisma.brand.findUnique).mockResolvedValue(makeBrand(OWNER_ID) as never);

    await expect(renderPage()).resolves.toBeDefined();
    expect(prisma.brand.findUnique).toHaveBeenCalledWith({ where: { slug: "cosmicpath" } });
  });

  it("returns not found without querying the brand when there is no session", async () => {
    vi.mocked(getSessionUserId).mockResolvedValue(null);

    await expect(renderPage()).rejects.toThrow("NEXT_NOT_FOUND");
    expect(prisma.brand.findUnique).not.toHaveBeenCalled();
  });

  it("returns not found when the session user does not own the brand", async () => {
    vi.mocked(getSessionUserId).mockResolvedValue("user-other");
    vi.mocked(prisma.brand.findUnique).mockResolvedValue(makeBrand(OWNER_ID) as never);

    await expect(renderPage()).rejects.toThrow("NEXT_NOT_FOUND");
  });
});
