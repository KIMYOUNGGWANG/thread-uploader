import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  brand: { findUniqueOrThrow: vi.fn(), update: vi.fn() },
  post: { findUnique: vi.fn(), create: vi.fn() },
}));
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

import { buildInstagramBioLink, ensureInstagramBioAnchor, tryBuildInstagramBioLink } from "@/lib/instagram-bio-anchor";

beforeEach(() => vi.clearAllMocks());

describe("ensureInstagramBioAnchor", () => {
  it("creates an ANCHOR post once and stores its id in brandConfig", async () => {
    prismaMock.brand.findUniqueOrThrow.mockResolvedValue({ id: "b1", brandConfig: JSON.stringify({ fidelity: 1 }) });
    prismaMock.post.create.mockResolvedValue({ id: "anchor1" });

    const anchorId = await ensureInstagramBioAnchor("b1");

    expect(anchorId).toBe("anchor1");
    expect(prismaMock.post.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.post.create.mock.calls[0]?.[0].data).toMatchObject({
      brandId: "b1",
      status: "ANCHOR",
      postCategory: "INSTAGRAM_BIO",
      content: "[instagram bio anchor]",
    });
    const saved = JSON.parse(prismaMock.brand.update.mock.calls[0]?.[0].data.brandConfig);
    expect(saved.instagram.bioAnchorPostId).toBe("anchor1");
    expect(saved.fidelity).toBe(1);
  });

  it("reuses the stored anchor when it still exists", async () => {
    prismaMock.brand.findUniqueOrThrow.mockResolvedValue({
      id: "b1",
      brandConfig: JSON.stringify({ instagram: { bioAnchorPostId: "anchor1" } }),
    });
    prismaMock.post.findUnique.mockResolvedValue({ id: "anchor1" });

    expect(await ensureInstagramBioAnchor("b1")).toBe("anchor1");
    expect(prismaMock.post.create).not.toHaveBeenCalled();
    expect(prismaMock.brand.update).not.toHaveBeenCalled();
  });

  it("recreates the anchor when the stored post is gone", async () => {
    prismaMock.brand.findUniqueOrThrow.mockResolvedValue({
      id: "b1",
      brandConfig: JSON.stringify({ instagram: { bioAnchorPostId: "gone" } }),
    });
    prismaMock.post.findUnique.mockResolvedValue(null);
    prismaMock.post.create.mockResolvedValue({ id: "anchor2" });

    expect(await ensureInstagramBioAnchor("b1")).toBe("anchor2");
  });
});

describe("buildInstagramBioLink", () => {
  it("builds the bio link to /start with pid and utm_source=instagram", () => {
    const url = new URL(buildInstagramBioLink("https://cosmicpath.app", "p1"));
    expect(url.pathname).toBe("/start");
    expect(url.searchParams.get("pid")).toBe("p1");
    expect(url.searchParams.get("utm_source")).toBe("instagram");
    expect(url.searchParams.get("ref")).toBe("instagram");
  });

  it("defaults to https for a scheme-less website URL", () => {
    const url = new URL(buildInstagramBioLink("cosmicpath.app", "p1"));
    expect(url.origin).toBe("https://cosmicpath.app");
    expect(url.pathname).toBe("/start");
    expect(url.searchParams.get("pid")).toBe("p1");
    expect(url.searchParams.get("utm_source")).toBe("instagram");
  });
});

describe("tryBuildInstagramBioLink", () => {
  it("returns null instead of throwing for unusable website URLs or a missing anchor", () => {
    expect(tryBuildInstagramBioLink("", "p1")).toBeNull();
    expect(tryBuildInstagramBioLink("http://", "p1")).toBeNull();
    expect(tryBuildInstagramBioLink("https://cosmicpath.app", undefined)).toBeNull();
  });

  it("returns the link for a bare domain", () => {
    expect(tryBuildInstagramBioLink("cosmicpath.app", "p1")).toContain("https://cosmicpath.app/start");
  });
});
