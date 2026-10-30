import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const db = vi.hoisted(() => ({
  draft: {
    updateMany: vi.fn(async (_args?: unknown) => ({ count: 1 })),
    findFirst: vi.fn(async (_args?: unknown): Promise<unknown> => null),
    findUnique: vi.fn(async (_args?: unknown): Promise<unknown> => null),
    findMany: vi.fn(async (_args?: unknown): Promise<unknown[]> => []),
    count: vi.fn(async (_args?: unknown) => 0),
    create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: "d_new", ...data })),
    update: vi.fn(async (_args?: unknown) => ({})),
  },
  clip: {
    findMany: vi.fn(async (_args?: unknown): Promise<unknown[]> => []),
    update: vi.fn(async (_args?: unknown) => ({})),
  },
  generate: vi.fn(),
  executeRaw: vi.fn(async (..._args: unknown[]) => 1),
}));

vi.mock("@/lib/video-factory/generate-kinetic-list", () => ({ generateKineticListScript: db.generate }));

vi.mock("@/lib/prisma", () => {
  const prisma = {
    brand: { findMany: vi.fn(async () => [{ id: "b1", slug: "cosmicpath", name: "코스믹패스", brandConfig: "{}" }]) },
    videoDraft: db.draft,
    clipAsset: db.clip,
    $executeRaw: db.executeRaw,
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(prisma)),
  };
  return { prisma };
});

import { GET as next } from "./next/route";
import { POST as complete } from "./complete/route";

const script = {
  hook: { kicker: "11월,", lines: ["이직", "고민 중이면"] },
  intro: { l1: "일간별로", l2: "딱 하나만" },
  items: [
    { glyph: "丙", label: "병화", action: ["제안 오면", "하루 안에 답하기"] },
    { glyph: "壬", label: "임수", action: ["연말까지는", "지금 자리 지키기"] },
    { glyph: "己", label: "기토", action: ["이력서보다", "서류 정리 먼저"] },
  ],
  cta: { l1: "내 일간 모르면", l2: "프로필 링크 → 1분" },
  captions: { instagram: "i", youtube: "y", tiktok: "t" },
  hashtags: ["#사주"],
};

const nextRequest = (query = "?brands=cosmicpath", headers?: Record<string, string>) =>
  new NextRequest(`http://localhost/api/cron/video-factory/next${query}`, { headers });
const completeRequest = (body: unknown) =>
  new NextRequest("http://localhost/api/cron/video-factory/complete", { method: "POST", body: JSON.stringify(body) });

describe("video factory next", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    db.draft.findFirst.mockResolvedValue(null);
    db.draft.findMany.mockResolvedValue([]);
    db.draft.count.mockResolvedValue(0);
    db.clip.findMany.mockResolvedValue([]);
    db.generate.mockResolvedValue({ ok: true, script });
  });

  it("requires the cron secret", async () => {
    vi.stubEnv("CRON_SECRET", "s3cret");
    expect((await next(nextRequest())).status).toBe(401);
  });

  it("requires a brand filter", async () => {
    expect((await next(nextRequest(""))).status).toBe(400);
  });

  it("creates and claims a RENDERING draft with template variables", async () => {
    db.clip.findMany.mockResolvedValue([{ id: "c1", fileUrl: "https://blob.example/c.mp4", usedCount: 0, lastUsedAt: null }]);
    const body = await (await next(nextRequest())).json();
    expect(db.draft.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        brandId: "b1", status: "RENDERING", formatId: "kinetic_list", voiceMode: "bgm_only",
        kstDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/), clipAssetId: "c1",
        script: JSON.stringify(script), captions: JSON.stringify(script.captions), hashtags: JSON.stringify(script.hashtags),
      }),
    });
    expect(body.job).toMatchObject({
      draftId: "d_new", brandSlug: "cosmicpath", blobPrefix: "videos/factory/cosmicpath/d_new",
      variables: { hook1: "이직", hookSrc: "https://blob.example/c.mp4", hookKind: "video" },
    });
  });

  it("passes the last drafts' hook lines as recentHooks and skips unparseable ones", async () => {
    db.draft.findMany.mockResolvedValue([{ script: JSON.stringify(script) }, { script: "not json" }, { script: "{}" }]);
    await next(nextRequest());
    expect(db.generate).toHaveBeenCalledWith(expect.objectContaining({ recentHooks: ["이직 고민 중이면"] }));
    expect(db.draft.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 14 }));
  });

  it("does not create a second draft on the same KST day", async () => {
    db.draft.count.mockResolvedValueOnce(1);
    expect((await (await next(nextRequest())).json()).job).toBeNull();
    expect(db.draft.count).toHaveBeenCalledWith({
      where: expect.objectContaining({ status: { in: ["COMPLETED", "RENDERING"] } }),
    });
    expect(db.draft.create).not.toHaveBeenCalled();
  });

  it("force creates another draft until three per day", async () => {
    db.draft.count.mockResolvedValueOnce(2);
    expect((await (await next(nextRequest("?brands=cosmicpath&force=1"))).json()).job).not.toBeNull();
    db.draft.count.mockResolvedValueOnce(3);
    expect((await (await next(nextRequest("?brands=cosmicpath&force=1"))).json()).job).toBeNull();
    expect(db.draft.create).toHaveBeenCalledTimes(1);
  });

  it("requeues stale RENDERING drafts", async () => {
    await next(nextRequest());
    const arg = db.draft.updateMany.mock.calls[0][0] as { where: { status: string; updatedAt: { lt: Date } }; data: unknown };
    expect(arg.where.status).toBe("RENDERING");
    expect(Date.now() - arg.where.updatedAt.lt.getTime()).toBeGreaterThanOrEqual(30 * 60 * 1000 - 1000);
    expect(arg.data).toEqual({ status: "QUEUED" });
  });

  it("claims a stale-requeued QUEUED draft and rebuilds variables from its script and clip", async () => {
    db.draft.findFirst.mockResolvedValue({
      id: "d_q", script: JSON.stringify(script), clipAsset: { fileUrl: "https://blob.example/q.png" },
    });
    const body = await (await next(nextRequest())).json();
    expect(body.job).toMatchObject({ draftId: "d_q", variables: { hook1: "이직", hookSrc: "https://blob.example/q.png", hookKind: "image" } });
    expect(db.draft.create).not.toHaveBeenCalled();
  });

  it("claims the QUEUED draft only while it is still QUEUED", async () => {
    db.draft.findFirst.mockResolvedValue({ id: "d_q", script: JSON.stringify(script), clipAsset: null });
    await next(nextRequest());
    expect(db.draft.updateMany).toHaveBeenCalledWith({ where: { id: "d_q", status: "QUEUED" }, data: { status: "RENDERING" } });
  });

  it("force counts every status when checking the cap", async () => {
    await next(nextRequest("?brands=cosmicpath&force=1"));
    for (const [arg] of db.draft.count.mock.calls) {
      expect(arg).toEqual({ where: { brandId: "b1", kstDate: expect.any(String) } });
    }
    expect(db.draft.count).toHaveBeenCalledTimes(2);
  });

  it("takes the advisory lock before re-counting inside the transaction", async () => {
    await next(nextRequest());
    const lockOrder = db.executeRaw.mock.invocationCallOrder[0];
    expect(db.executeRaw).toHaveBeenCalledTimes(1);
    expect(String((db.executeRaw.mock.calls[0][0] as string[]).join(""))).toContain("pg_advisory_xact_lock");
    expect(lockOrder).toBeLessThan(db.draft.count.mock.invocationCallOrder[2]);
    expect(lockOrder).toBeLessThan(db.draft.create.mock.invocationCallOrder[0]);
  });

  it("creates nothing when a concurrent call took the slot during generation", async () => {
    db.draft.count.mockResolvedValueOnce(0).mockResolvedValueOnce(0).mockResolvedValueOnce(1);
    expect((await (await next(nextRequest())).json()).job).toBeNull();
    expect(db.draft.create).not.toHaveBeenCalled();
  });

  it("without force, stops at three drafts a day even when none are COMPLETED/RENDERING", async () => {
    db.draft.count.mockResolvedValueOnce(0).mockResolvedValueOnce(3); // 0 active, 3 FAILED today
    expect((await (await next(nextRequest())).json()).job).toBeNull();
    expect(db.generate).not.toHaveBeenCalled();
    expect(db.draft.create).not.toHaveBeenCalled();
  });

  it("without force, re-checks the total cap under the lock", async () => {
    db.draft.count
      .mockResolvedValueOnce(0).mockResolvedValueOnce(2) // early: under the cap
      .mockResolvedValueOnce(0).mockResolvedValueOnce(3); // locked: concurrent runs hit the cap
    expect((await (await next(nextRequest())).json()).job).toBeNull();
    expect(db.draft.create).not.toHaveBeenCalled();
  });

  it("does not record a DB error as a generate failure", async () => {
    db.draft.create.mockRejectedValueOnce(new Error("db down"));
    await expect(next(nextRequest())).rejects.toThrow("db down");
    expect(db.draft.create).toHaveBeenCalledTimes(1);
  });

  it("stores a FAILED draft when generation fails", async () => {
    db.generate.mockResolvedValue({ ok: false, errors: ["too long"] });
    expect((await (await next(nextRequest())).json()).job).toBeNull();
    expect(db.draft.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ status: "FAILED", renderErrors: JSON.stringify(["too long"]) }),
    });
  });

  it("stores a FAILED draft instead of a 500 when generation throws", async () => {
    db.generate.mockRejectedValue(new Error("network down"));
    const res = await next(nextRequest());
    expect(res.status).toBe(200);
    expect((await res.json()).job).toBeNull();
    expect(db.draft.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ status: "FAILED", renderErrors: JSON.stringify(["generate: network down"]) }),
    });
  });
});

describe("video factory complete", () => {
  beforeEach(() => vi.clearAllMocks());
  const ok = { draftId: "d1", videoUrl: "https://blob.example/v.mp4", coverUrl: "https://blob.example/c.png" };

  it("completes a RENDERING draft and bumps the clip once", async () => {
    db.draft.updateMany.mockResolvedValueOnce({ count: 1 });
    db.draft.findUnique.mockResolvedValueOnce({ clipAssetId: "c1" });
    const res = await complete(completeRequest(ok));
    expect(await res.json()).toEqual({ ok: true });
    expect(db.draft.updateMany).toHaveBeenCalledWith({
      where: { id: "d1", status: "RENDERING" },
      data: { status: "COMPLETED", videoUrl: ok.videoUrl, coverUrl: ok.coverUrl },
    });
    expect(db.clip.update).toHaveBeenCalledTimes(1);
    expect(db.clip.update).toHaveBeenCalledWith({
      where: { id: "c1" }, data: { usedCount: { increment: 1 }, lastUsedAt: expect.any(Date) },
    });
  });

  it("rejects completion for a draft that is not RENDERING", async () => {
    db.draft.updateMany.mockResolvedValueOnce({ count: 0 });
    db.draft.findUnique.mockResolvedValueOnce({ id: "d1" });
    expect((await complete(completeRequest(ok))).status).toBe(409);
    expect(db.clip.update).not.toHaveBeenCalled();
  });

  it("returns 404 for an unknown draft", async () => {
    db.draft.updateMany.mockResolvedValueOnce({ count: 0 });
    db.draft.findUnique.mockResolvedValueOnce(null);
    expect((await complete(completeRequest(ok))).status).toBe(404);
  });

  it("stores render errors as FAILED without bumping the clip", async () => {
    db.draft.updateMany.mockResolvedValueOnce({ count: 1 });
    expect((await complete(completeRequest({ draftId: "d1", errors: ["chromium crashed"] }))).status).toBe(200);
    expect(db.draft.updateMany).toHaveBeenCalledWith({
      where: { id: "d1", status: "RENDERING" },
      data: { status: "FAILED", renderErrors: JSON.stringify(["chromium crashed"]) },
    });
    expect(db.clip.update).not.toHaveBeenCalled();
  });

  it.each([
    ["no draftId", { videoUrl: ok.videoUrl, coverUrl: ok.coverUrl }],
    ["http url", { ...ok, videoUrl: "http://blob.example/v.mp4" }],
    ["missing cover", { draftId: "d1", videoUrl: ok.videoUrl }],
    ["empty errors", { draftId: "d1", errors: [] }],
    ["non-string errors", { draftId: "d1", errors: [1] }],
    ["both shapes", { ...ok, errors: ["x"] }],
  ])("rejects a malformed body: %s", async (_name, body) => {
    expect((await complete(completeRequest(body))).status).toBe(400);
    expect(db.draft.updateMany).not.toHaveBeenCalled();
  });
});
