import { beforeEach, describe, expect, it, vi } from "vitest";

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

vi.mock("@/lib/youtube/shorts-feed", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/youtube/shorts-feed")>();
  return {
    ...actual,
    loadShortsFeed: vi.fn(async () => ({ items: [], lastCapturedAt: null })),
  };
});

import { getSessionUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loadShortsFeed } from "@/lib/youtube/shorts-feed";
import BrandShortsPage from "./page";

const getSessionUserIdMock = vi.mocked(getSessionUserId);
const findUniqueMock = vi.mocked(prisma.brand.findUnique);
const loadShortsFeedMock = vi.mocked(loadShortsFeed);

function renderPage(slug: string) {
  return BrandShortsPage({
    params: Promise.resolve({ slug }),
    searchParams: Promise.resolve({}),
  });
}

describe("BrandShortsPage session check", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads the feed when the session user owns the brand", async () => {
    getSessionUserIdMock.mockResolvedValue("user-1");
    findUniqueMock.mockResolvedValue({
      id: "b1",
      slug: "cosmicpath",
      name: "CosmicPath",
      ownerId: "user-1",
      brandConfig: "{}",
    } as never);

    await expect(renderPage("cosmicpath")).resolves.toBeDefined();
    expect(loadShortsFeedMock).toHaveBeenCalledWith(
      expect.objectContaining({ brandId: "b1" })
    );
  });

  it("returns notFound when there is no session", async () => {
    getSessionUserIdMock.mockResolvedValue(null);

    await expect(renderPage("cosmicpath")).rejects.toThrow("NEXT_NOT_FOUND");
    expect(findUniqueMock).not.toHaveBeenCalled();
  });

  it("returns notFound when the session user does not own the brand", async () => {
    getSessionUserIdMock.mockResolvedValue("user-1");
    findUniqueMock.mockResolvedValue({
      id: "b1",
      slug: "cosmicpath",
      name: "CosmicPath",
      ownerId: "someone-else",
      brandConfig: "{}",
    } as never);

    await expect(renderPage("cosmicpath")).rejects.toThrow("NEXT_NOT_FOUND");
    expect(loadShortsFeedMock).not.toHaveBeenCalled();
  });
});
