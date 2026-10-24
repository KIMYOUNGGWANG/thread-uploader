import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  verify: vi.fn(),
  findBrand: vi.fn(),
  findPosts: vi.fn(),
  updatePost: vi.fn(),
  rules: vi.fn(),
  judge: vi.fn(),
}));

vi.mock("@/lib/cron-auth", () => ({ verifyCronSecret: mocks.verify }));
vi.mock("@/lib/prisma", () => ({
  prisma: { brand: { findUnique: mocks.findBrand }, post: { findMany: mocks.findPosts, update: mocks.updatePost } },
}));
vi.mock("@/lib/readability-rules", () => ({ checkReadabilityRules: mocks.rules }));
vi.mock("@/lib/readability-judge", () => ({ judgeReadability: mocks.judge }));

const call = async (query: string) => {
  const { GET } = await import("@/app/api/cron/regate-pending/route");
  const response = await GET({ headers: new Headers(), nextUrl: new URL(`http://localhost/api/cron/regate-pending?${query}`) } as never);
  return { status: response.status, body: await response.json() };
};

const post = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  content: `본문 ${id}`,
  firstComment: `댓글 ${id}`,
  formulaId: "f1",
  qualityReasons: "[]",
  ...extra,
});

describe("GET /api/cron/regate-pending", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.verify.mockReturnValue(true);
    mocks.findBrand.mockResolvedValue({ id: "b1", slug: "cosmicpath", brandConfig: JSON.stringify({ qualityProfile: "saju_viral" }) });
    mocks.rules.mockImplementation((content: string) =>
      content.includes("bad") ? { pass: false, reasons: ["룰 위반"] } : { pass: true, reasons: [] },
    );
    mocks.judge.mockResolvedValue({ readable: true, reason: "" });
  });

  it("rejects a request without the cron secret", async () => {
    mocks.verify.mockReturnValue(false);
    expect((await call("brand=cosmicpath")).status).toBe(401);
  });

  it("rejects a missing brand, an unknown slug, and a non-saju brand", async () => {
    expect((await call("")).status).toBe(400);
    mocks.findBrand.mockResolvedValueOnce(null);
    expect((await call("brand=nope")).status).toBe(404);
    mocks.findBrand.mockResolvedValueOnce({ id: "b2", slug: "other", brandConfig: JSON.stringify({ qualityProfile: "career_decision" }) });
    const { status, body } = await call("brand=other");
    expect(status).toBe(400);
    expect(body.error).toBe("regate-pending supports saju_viral brands only");
  });

  it("reports failures without writing when apply is not set", async () => {
    mocks.findPosts.mockResolvedValue([post("p1", { content: "bad" }), post("p2")]);
    const { body } = await call("brand=cosmicpath");
    expect(body).toEqual({ brand: "cosmicpath", apply: false, checked: 2, failed: [{ id: "p1", reasons: ["룰 위반"] }] });
    expect(mocks.updatePost).not.toHaveBeenCalled();
  });

  it("archives only failing posts when apply=true", async () => {
    mocks.findPosts.mockResolvedValue([post("p1", { content: "bad" }), post("p2"), post("p3")]);
    mocks.judge.mockImplementation(async (content: string) =>
      content === "본문 p3" ? { readable: false, reason: "이해 불가" } : { readable: true, reason: "" },
    );
    const { body } = await call("brand=cosmicpath&apply=true");
    expect(body.apply).toBe(true);
    expect(body.failed).toEqual([
      { id: "p1", reasons: ["룰 위반"] },
      { id: "p3", reasons: ["읽힘 판정 실패: 이해 불가"] },
    ]);
    expect(mocks.updatePost).toHaveBeenCalledTimes(2);
    expect(mocks.updatePost).toHaveBeenCalledWith({
      where: { id: "p1" },
      data: { status: "ARCHIVED", qualityReasons: JSON.stringify(["regate_readability_failed: 룰 위반"]) },
    });
    expect(mocks.updatePost).not.toHaveBeenCalledWith(expect.objectContaining({ where: { id: "p2" } }));
  });

  it("skips the judge when the rules already failed", async () => {
    mocks.findPosts.mockResolvedValue([post("p1", { content: "bad" })]);
    await call("brand=cosmicpath");
    expect(mocks.judge).not.toHaveBeenCalled();
  });

  it("skips promo video posts", async () => {
    mocks.findPosts.mockResolvedValue([post("p1", { formulaId: "video:promo:2026-10-27", content: "bad" }), post("p2", { formulaId: null })]);
    const { body } = await call("brand=cosmicpath");
    expect(body.checked).toBe(1);
    expect(body.failed).toEqual([]);
  });

  it("appends to existing qualityReasons and archives even when the stored value is malformed", async () => {
    mocks.findPosts.mockResolvedValue([
      post("p1", { content: "bad", qualityReasons: JSON.stringify(["old"]) }),
      post("p2", { content: "bad", qualityReasons: "not json{" }),
      post("p3", { content: "bad", qualityReasons: '{"a":1}' }),
    ]);
    await call("brand=cosmicpath&apply=true");
    const reasonsOf = (id: string) => {
      const arg = mocks.updatePost.mock.calls.map(([a]) => a).find((a) => a.where.id === id);
      return { status: arg.data.status, reasons: JSON.parse(arg.data.qualityReasons) };
    };
    expect(reasonsOf("p1")).toEqual({ status: "ARCHIVED", reasons: ["old", "regate_readability_failed: 룰 위반"] });
    expect(reasonsOf("p2")).toEqual({ status: "ARCHIVED", reasons: ["regate_readability_failed: 룰 위반"] });
    expect(reasonsOf("p3")).toEqual({ status: "ARCHIVED", reasons: ["regate_readability_failed: 룰 위반"] });
  });
});
