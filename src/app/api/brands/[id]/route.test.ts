import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

process.env.ENCRYPTION_KEY = "test-encryption-key";

const stored = { id: "b1", ownerId: "u1", name: "C", slug: "c", brandConfig: "{}", accessToken: "enc-old", formulaWeights: "{}", tokenExpiry: null, createdAt: new Date(), updatedAt: new Date() };

vi.mock("@/lib/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth")>();
  return { ...actual, requireAuth: vi.fn(async () => ({ id: "u1", email: "o@example.com", name: null })) };
});
vi.mock("@/lib/prisma", () => ({
  prisma: {
    brand: {
      findUnique: vi.fn(async () => stored),
      update: vi.fn(async (args?: { data?: Record<string, unknown> }) => ({ ...stored, ...args?.data })),
      // brandConfig is saved through patchBrandConfig: re-read the brand (findUnique), then a compare-and-set updateMany
      updateMany: vi.fn<(args: { where: object; data: { brandConfig: string } }) => Promise<{ count: number }>>(async () => ({ count: 1 })),
    },
  },
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

function savedConfig() {
  return JSON.parse(String(vi.mocked(prisma.brand.updateMany).mock.calls[0][0].data.brandConfig));
}

describe("PATCH /api/brands/[id] instagram config", () => {
  beforeEach(() => vi.mocked(prisma.brand.updateMany).mockClear());
  afterEach(() => { stored.brandConfig = "{}"; });

  it("keeps the stored bioAnchorPostId when a stale form sends instagram without it", async () => {
    stored.brandConfig = JSON.stringify({ instagram: { captionSuffix: "old", bioAnchorPostId: "anchor1" } });

    await patch({ brandConfig: { instagram: { captionSuffix: "new" } } });

    const saved = savedConfig();
    expect(saved.instagram).toMatchObject({ captionSuffix: "new", bioAnchorPostId: "anchor1" });
  });
});

describe("PATCH /api/brands/[id] concurrent writers", () => {
  beforeEach(() => vi.mocked(prisma.brand.updateMany).mockClear());

  // The request reads the brand first. Priors the learn cron saved before this write used to be reverted because the
  // whole parsed config was merged into the raw string read at the start.
  it("saves the form's changes on top of the config stored now, not the one read at the start", async () => {
    const meanwhile = JSON.stringify({ topics: ["old topic"], thompsonPriors: { winner: { alpha: 5, beta: 2 } } });
    vi.mocked(prisma.brand.findUnique)
      .mockResolvedValueOnce({ ...stored, brandConfig: JSON.stringify({ topics: ["old topic"] }) } as never)
      .mockResolvedValueOnce({ brandConfig: meanwhile } as never);

    await patch({ brandConfig: { topics: ["new topic"] } });

    const saved = savedConfig();
    expect(saved.topics).toEqual(["new topic"]);
    expect(saved.thompsonPriors).toEqual({ winner: { alpha: 5, beta: 2 } });
  });
});
