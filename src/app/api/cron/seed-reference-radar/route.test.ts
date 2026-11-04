import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  verify: vi.fn(),
  findBrand: vi.fn(),
  updateBrand: vi.fn(async () => ({})),
  lookup: vi.fn(async () => "cosmicpath.app" as string | undefined),
}));

vi.mock("@/lib/cron-auth", () => ({ verifyCronSecret: mocks.verify }));
vi.mock("@/lib/prisma", () => ({ prisma: { brand: { findUnique: mocks.findBrand, update: mocks.updateBrand } } }));
vi.mock("@/lib/reference-radar-seed", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/reference-radar-seed")>()),
  lookupThreadsUsername: mocks.lookup,
}));

const call = async (query: string) => {
  const { GET } = await import("@/app/api/cron/seed-reference-radar/route");
  const response = await GET({ headers: new Headers(), nextUrl: new URL(`http://localhost/api/cron/seed-reference-radar?${query}`) } as never);
  return { status: response.status, body: await response.json() };
};

describe("GET /api/cron/seed-reference-radar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.verify.mockReturnValue(true);
    mocks.findBrand.mockResolvedValue({ id: "b1", threadsUserId: "123", brandConfig: JSON.stringify({ qualityProfile: "saju_viral", other: 1 }) });
  });

  it("rejects a request without the cron secret, and any brand but cosmicpath", async () => {
    mocks.verify.mockReturnValueOnce(false);
    expect((await call("brand=cosmicpath")).status).toBe(401);
    expect((await call("brand=other")).status).toBe(400);
  });

  it("previews without writing", async () => {
    const { body } = await call("brand=cosmicpath");
    expect(body.written).toBe(false);
    expect(body.changes.keywords).toContain("사주");
    expect(mocks.updateBrand).not.toHaveBeenCalled();
  });

  it("writes only the empty fields and keeps the rest of brandConfig", async () => {
    const { body } = await call("brand=cosmicpath&apply=true");
    expect(body.written).toBe(true);
    const saved = JSON.parse((mocks.updateBrand.mock.calls[0] as unknown as [{ data: { brandConfig: string } }])[0].data.brandConfig);
    expect(saved.other).toBe(1);
    expect(saved.viralDiscovery.keywords).toContain("궁합");
    expect(saved.viralDiscovery.ownHandle).toBe("cosmicpath.app");
  });

  it("does not write when keywords and handle are already set", async () => {
    mocks.findBrand.mockResolvedValue({
      id: "b1",
      threadsUserId: "123",
      brandConfig: JSON.stringify({ viralDiscovery: { keywords: ["타로"], ownHandle: "me" } }),
    });
    const { body } = await call("brand=cosmicpath&apply=true");
    expect(body).toMatchObject({ written: false, changes: {}, keywords: ["타로"], ownHandle: "me" });
    expect(mocks.lookup).not.toHaveBeenCalled();
    expect(mocks.updateBrand).not.toHaveBeenCalled();
  });
});
