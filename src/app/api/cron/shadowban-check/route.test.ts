import { beforeEach, describe, expect, it, vi } from "vitest";

// Detection only: the cron never writes brandConfig. Enforcement (1 warmup post a day, no links) stays a human click
// on the account-health banner, because a false positive would silently throttle a live account.
const mocks = vi.hoisted(() => ({
  verifyCronSecret: vi.fn(() => true),
  findBrands: vi.fn(),
  updateBrand: vi.fn(),
  evaluateBrandShadowban: vi.fn(),
  sendSystemAlert: vi.fn(async () => false),
}));

vi.mock("@/lib/cron-auth", () => ({ verifyCronSecret: mocks.verifyCronSecret }));
vi.mock("@/lib/prisma", () => ({ prisma: { brand: { findMany: mocks.findBrands, update: mocks.updateBrand } } }));
vi.mock("@/lib/shadowban-check", () => ({ evaluateBrandShadowban: mocks.evaluateBrandShadowban }));
vi.mock("@/lib/alert-service", () => ({ sendSystemAlert: mocks.sendSystemAlert }));

function report(status: "HEALTHY" | "WARNING" | "SHADOWBAN_SUSPECTED", dropPercentage = 0) {
  return {
    status,
    recentAverageViews: 10,
    baselineAverageViews: 500,
    dropPercentage,
    analyzedPostCount: 18,
    consecutiveDepressedCount: status === "SHADOWBAN_SUSPECTED" ? 3 : 0,
    reasons: [`reason for ${status}`],
  };
}

const brand = (slug: string, brandConfig = "{}") => ({ id: `id_${slug}`, name: slug.toUpperCase(), slug, brandConfig });

async function callCheck() {
  const { GET } = await import("@/app/api/cron/shadowban-check/route");
  const response = await GET({ headers: new Headers() } as never);
  return { status: response.status, body: await response.json() };
}

describe("GET /api/cron/shadowban-check", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.verifyCronSecret.mockReturnValue(true);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it("answers 401 without the cron secret", async () => {
    mocks.verifyCronSecret.mockReturnValue(false);

    const { status } = await callCheck();

    expect(status).toBe(401);
    expect(mocks.findBrands).not.toHaveBeenCalled();
  });

  it("answers 200 and stays quiet when every brand is healthy", async () => {
    mocks.findBrands.mockResolvedValue([brand("alpha"), brand("beta")]);
    mocks.evaluateBrandShadowban.mockResolvedValue(report("HEALTHY"));

    const { status, body } = await callCheck();

    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.brands.map((entry: { slug: string; status: string }) => [entry.slug, entry.status])).toEqual([["alpha", "HEALTHY"], ["beta", "HEALTHY"]]);
    expect(mocks.sendSystemAlert).not.toHaveBeenCalled();
    expect(mocks.updateBrand).not.toHaveBeenCalled();
  });

  it("answers 500 and alerts when a brand looks shadowbanned, without changing its status", async () => {
    mocks.findBrands.mockResolvedValue([brand("alpha")]);
    mocks.evaluateBrandShadowban.mockResolvedValue(report("SHADOWBAN_SUSPECTED", 92));

    const { status, body } = await callCheck();

    expect(status).toBe(500);
    expect(body.success).toBe(false);
    expect(body.brands[0]).toEqual(expect.objectContaining({ slug: "alpha", status: "SHADOWBAN_SUSPECTED", dropPercentage: 92 }));
    expect(mocks.sendSystemAlert).toHaveBeenCalledWith(expect.objectContaining({ level: "error", brandName: "ALPHA" }));
    expect(mocks.updateBrand).not.toHaveBeenCalled();
  });

  it("skips a brand that is already in shadowban mode (the alert would repeat every day)", async () => {
    mocks.findBrands.mockResolvedValue([brand("alpha", JSON.stringify({ accountHealth: { status: "SHADOWBAN_SUSPECTED" } }))]);

    const { status, body } = await callCheck();

    expect(status).toBe(200);
    expect(body.brands[0]).toEqual(expect.objectContaining({ slug: "alpha", skipped: "already_in_shadowban_mode" }));
    expect(mocks.evaluateBrandShadowban).not.toHaveBeenCalled();
    expect(mocks.sendSystemAlert).not.toHaveBeenCalled();
  });

  it("also skips a brand whose legacy shadowbanStatus is already suspected", async () => {
    mocks.findBrands.mockResolvedValue([brand("alpha", JSON.stringify({ shadowbanStatus: "SHADOWBAN_SUSPECTED" }))]);

    const { status, body } = await callCheck();

    expect(status).toBe(200);
    expect(body.brands[0].skipped).toBe("already_in_shadowban_mode");
  });

  it("reports a warning in the body but answers 200 and does not alert", async () => {
    mocks.findBrands.mockResolvedValue([brand("alpha")]);
    mocks.evaluateBrandShadowban.mockResolvedValue(report("WARNING", 60));

    const { status, body } = await callCheck();

    expect(status).toBe(200);
    expect(body.brands[0]).toEqual(expect.objectContaining({ status: "WARNING", dropPercentage: 60 }));
    expect(mocks.sendSystemAlert).not.toHaveBeenCalled();
  });

  it("answers 500 when one brand's evaluation throws, and still checks the others", async () => {
    mocks.findBrands.mockResolvedValue([brand("alpha"), brand("beta")]);
    mocks.evaluateBrandShadowban.mockRejectedValueOnce(new Error("db down")).mockResolvedValueOnce(report("HEALTHY"));

    const { status, body } = await callCheck();

    expect(status).toBe(500);
    expect(body.success).toBe(false);
    expect(body.brands).toEqual([
      { slug: "alpha", success: false, error: "db down" },
      expect.objectContaining({ slug: "beta", status: "HEALTHY" }),
    ]);
  });
});
