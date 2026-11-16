import { beforeEach, describe, expect, it, vi } from "vitest";

// The "Fetch Post Metrics" workflow calls this route with curl --fail-with-body and only goes red (and emails)
// on a non-2xx answer; a brand whose learning threw used to be buried in a 200 with success: true.
const mocks = vi.hoisted(() => ({
  learnBrandGrowth: vi.fn(),
}));

vi.mock("@/lib/cron-auth", () => ({ verifyCronSecret: () => true }));
vi.mock("@/lib/prisma", () => ({
  prisma: { brand: { findMany: vi.fn(async () => [{ id: "b1", slug: "alpha" }, { id: "b2", slug: "beta" }]) } },
}));
vi.mock("@/lib/growth-service", () => ({ learnBrandGrowth: mocks.learnBrandGrowth }));

const LEARNED = { learnedPosts: 5, learningInputDiff: null, promotedFormulas: [], demotedFormulas: [], weeklyLift: 0 };

async function callLearn() {
  const { GET } = await import("@/app/api/cron/learn/route");
  const response = await GET({ headers: new Headers() } as never);
  return { status: response.status, body: await response.json() };
}

describe("GET /api/cron/learn", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it("answers 200 when every brand learned", async () => {
    mocks.learnBrandGrowth.mockResolvedValue(LEARNED);

    const { status, body } = await callLearn();

    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.brands.map((brand: { slug: string; success: boolean }) => [brand.slug, brand.success])).toEqual([["alpha", true], ["beta", true]]);
  });

  it("answers 500 when a brand's learning throws, and still learns the other brands", async () => {
    mocks.learnBrandGrowth.mockRejectedValueOnce(new Error("growth memory is corrupt")).mockResolvedValueOnce(LEARNED);

    const { status, body } = await callLearn();

    expect(status).toBe(500);
    expect(body.success).toBe(false);
    expect(body.brands).toEqual([
      { slug: "alpha", success: false, error: "growth memory is corrupt" },
      expect.objectContaining({ slug: "beta", success: true }),
    ]);
  });
});
