import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  verify: vi.fn(),
  findBrand: vi.fn(),
  findPosts: vi.fn(),
  updatePost: vi.fn<(args: { where: { id: string }; data: { status: string; qualityReasons: string } }) => Promise<{ count: number }>>(async () => ({ count: 1 })),
  rules: vi.fn(),
  judge: vi.fn(),
}));

vi.mock("@/lib/cron-auth", () => ({ verifyCronSecret: mocks.verify }));
vi.mock("@/lib/prisma", () => ({
  prisma: { brand: { findUnique: mocks.findBrand }, post: { findMany: mocks.findPosts, updateMany: mocks.updatePost } },
}));
vi.mock("@/lib/readability-rules", () => ({ checkReadabilityRules: mocks.rules }));
vi.mock("@/lib/readability-judge", () => ({ judgeReadability: mocks.judge }));
vi.mock("@/lib/reference-replay", () => ({ REFERENCE_REPLAY_MANUAL_TAG: "ref_replay_manual" }));

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
    mocks.updatePost.mockResolvedValue({ count: 1 });
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

  it("rejects a missing brand, an unknown slug, and an unsupported brand", async () => {
    expect((await call("")).status).toBe(400);
    mocks.findBrand.mockResolvedValueOnce(null);
    expect((await call("brand=nope")).status).toBe(404);
    mocks.findBrand.mockResolvedValueOnce({ id: "b2", slug: "other", brandConfig: JSON.stringify({ qualityProfile: "career_decision" }) });
    const { status, body } = await call("brand=other");
    expect(status).toBe(400);
    expect(body.error).toBe("regate-pending supports saju_viral and ecommerce_d2c brands only");
  });

  it("reports failures without writing when apply is not set", async () => {
    mocks.findPosts.mockResolvedValue([post("p1", { content: "bad" }), post("p2")]);
    const { body } = await call("brand=cosmicpath");
    expect(body).toEqual({ brand: "cosmicpath", status: "PENDING", apply: false, checked: 2, failed: [{ id: "p1", reasons: ["룰 위반"] }], archived: 0, skipped: [] });
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
      where: { id: "p1", status: "PENDING" },
      data: { status: "ARCHIVED", qualityReasons: JSON.stringify(["regate_readability_failed: 룰 위반"]) },
    });
    expect(mocks.updatePost).not.toHaveBeenCalledWith(expect.objectContaining({ where: { id: "p2", status: "PENDING" } }));
  });

  it("does not write for apply=1 and reports apply: false", async () => {
    mocks.findPosts.mockResolvedValue([post("p1", { content: "bad" })]);
    const { body } = await call("brand=cosmicpath&apply=1");
    expect(body.apply).toBe(false);
    expect(mocks.updatePost).not.toHaveBeenCalled();
  });

  it("reports a post that left PENDING mid-run as skipped, not archived", async () => {
    mocks.findPosts.mockResolvedValue([post("p1", { content: "bad" }), post("p2", { content: "bad" })]);
    mocks.updatePost.mockResolvedValueOnce({ count: 0 }).mockResolvedValueOnce({ count: 1 });
    const { body } = await call("brand=cosmicpath&apply=true");
    expect(body.failed).toHaveLength(2);
    expect(body.skipped).toEqual([{ id: "p1", reason: "no longer PENDING" }]);
    expect(body.archived).toBe(1);
  });

  it("skips the judge when the rules already failed", async () => {
    mocks.findPosts.mockResolvedValue([post("p1", { content: "bad" })]);
    await call("brand=cosmicpath");
    expect(mocks.judge).not.toHaveBeenCalled();
  });

  it("gives concept_hierarchy posts the same 3-term allowance generation does", async () => {
    mocks.findPosts.mockResolvedValue([post("p1"), post("p2", { formulaId: "concept_hierarchy", content: "도화보다 센 화개" })]);
    await call("brand=cosmicpath");
    expect(mocks.rules).toHaveBeenNthCalledWith(1, "본문 p1", "댓글 p1", { maxJargonTerms: 1 });
    expect(mocks.rules).toHaveBeenNthCalledWith(2, "도화보다 센 화개", "댓글 p2", { maxJargonTerms: 3 });
    expect(mocks.judge).toHaveBeenNthCalledWith(2, "도화보다 센 화개", "댓글 p2", { rankedTerms: true });
  });

  // 2026-11-06: concept-first modes written before the rule open on a plain situation.
  it("fails a concept-first draft whose first line names no saju concept, without calling the judge", async () => {
    mocks.findPosts.mockResolvedValue([
      post("p1", { formulaId: "wealth_vault_unlock", content: "월급은 올랐는데 통장은 그대로인 사람\n진술축미는 창고 글자" }),
      post("p2", { formulaId: "wealth_vault_unlock", content: "사주에 진술축미 깔려 있으면 주목해\n창고 글자임" }),
    ]);
    const { body } = await call("brand=cosmicpath");
    expect(body.failed.map((row: { id: string }) => row.id)).toEqual(["p1"]);
    expect(body.failed[0].reasons[0]).toContain("첫 줄에 사주 개념이 없음");
    expect(mocks.judge).toHaveBeenCalledTimes(1);
  });

  it("regates global drafts on length, the A/B ending and correction openers, with no Korean judge", async () => {
    mocks.findBrand.mockResolvedValueOnce({ id: "g1", slug: "cosmicpath-global", brandConfig: JSON.stringify({ qualityProfile: "ecommerce_d2c" }) });
    mocks.findPosts.mockResolvedValue([
      post("ok", { formulaId: "check_in", content: "Water Day Masters, check in.\n\nYou feel it first." }),
      post("ab", { formulaId: "saturn_reboot_timeline", content: "Money moves in decades.\n\nA) I earn well\nB) I keep it\nWhich one are you?" }),
      post("neg", { formulaId: "saturn_reboot_timeline", content: "Your Saturn return is not your turning point.\n\nShort." }),
      post("long", { formulaId: "sky_now", content: `Sat Nov 7 starts the Pig month.\n\n${"x".repeat(320)}` }),
    ]);
    const { body } = await call("brand=cosmicpath-global");
    expect(body.failed.map((row: { id: string }) => row.id)).toEqual(["ab", "neg", "long"]);
    expect(mocks.rules).not.toHaveBeenCalled();
    expect(mocks.judge).not.toHaveBeenCalled();
  });

  // 2026-11-04: 13 unreviewed NEEDS_REVIEW drafts filled refill's backlog and stopped generation.
  it("regates NEEDS_REVIEW drafts when asked, archiving only while they are still NEEDS_REVIEW", async () => {
    mocks.findPosts.mockResolvedValue([post("p1", { content: "bad" }), post("p2")]);
    const { body } = await call("brand=cosmicpath&status=NEEDS_REVIEW&apply=true");
    expect(mocks.findPosts).toHaveBeenCalledWith(expect.objectContaining({ where: { brandId: "b1", status: "NEEDS_REVIEW" } }));
    expect(mocks.updatePost).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "p1", status: "NEEDS_REVIEW" } }));
    expect(body).toMatchObject({ status: "NEEDS_REVIEW", archived: 1 });
  });

  it("rejects any other status", async () => {
    expect((await call("brand=cosmicpath&status=PUBLISHED")).status).toBe(400);
  });

  it("never archives a draft rewritten from a hand-pasted reference", async () => {
    mocks.findPosts.mockResolvedValue([post("p1", { content: "bad", qualityReasons: JSON.stringify(["ref_replay_manual"]) })]);
    const { body } = await call("brand=cosmicpath&status=NEEDS_REVIEW&apply=true");
    expect(body.skipped).toEqual([{ id: "p1", reason: "manual reference" }]);
    expect(mocks.updatePost).not.toHaveBeenCalled();
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
      if (!arg) throw new Error(`no update for ${id}`);
      return { status: arg.data.status, reasons: JSON.parse(arg.data.qualityReasons) };
    };
    expect(reasonsOf("p1")).toEqual({ status: "ARCHIVED", reasons: ["old", "regate_readability_failed: 룰 위반"] });
    expect(reasonsOf("p2")).toEqual({ status: "ARCHIVED", reasons: ["regate_readability_failed: 룰 위반"] });
    expect(reasonsOf("p3")).toEqual({ status: "ARCHIVED", reasons: ["regate_readability_failed: 룰 위반"] });
  });

  it("judges the first comment generation wrote, without the bridge header and link lines added at save time", async () => {
    mocks.findPosts.mockResolvedValue([
      post("p1", { firstComment: "너라면 바로 답장해?\n\n📌 5대 계산 엔진(사주·점성술·자미두수) 교차 판정 리포트:\nhttps://cosmicpath.app/r/abc" }),
    ]);
    await call("brand=cosmicpath");
    expect(mocks.rules).toHaveBeenCalledWith("본문 p1", "너라면 바로 답장해?", { maxJargonTerms: 1 });
    expect(mocks.judge).toHaveBeenCalledWith("본문 p1", "너라면 바로 답장해?", { rankedTerms: false });
  });
});
