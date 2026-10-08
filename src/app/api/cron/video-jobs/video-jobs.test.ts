import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const db = vi.hoisted(() => ({
  draft: {
    updateMany: vi.fn(async () => ({ count: 1 })),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    count: vi.fn(async () => 0),
    create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: "d_new", createdAt: new Date(), ...data })),
    update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => data),
  },
  post: { create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: "p1", ...data })) },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    brand: { findMany: vi.fn(async () => [{ id: "b1", slug: "cosmicpath" }]) },
    tikTokVideoDraft: db.draft,
    post: db.post,
    $transaction: vi.fn(async (ops: Promise<unknown>[]) => Promise.all(ops)),
  },
}));

import { GET as next } from "./next/route";
import { POST as complete } from "./complete/route";

const nextRequest = (query = "?brands=cosmicpath") => new NextRequest(`http://localhost/api/cron/video-jobs/next${query}`);
const completeRequest = (body: Record<string, unknown>) =>
  new NextRequest("http://localhost/api/cron/video-jobs/complete", { method: "POST", body: JSON.stringify(body) });

describe("video jobs", () => {
  beforeEach(() => vi.clearAllMocks());

  it("requires a brand filter", async () => {
    expect((await next(nextRequest(""))).status).toBe(400);
  });

  it("creates and claims one daily draft as RENDERING with a 9:16 render spec", async () => {
    db.draft.findFirst.mockResolvedValue(null);
    const body = await (await next(nextRequest())).json();
    expect(db.draft.create).toHaveBeenCalledWith({ data: expect.objectContaining({ brandId: "b1", status: "RENDERING" }) });
    expect(body.job).toMatchObject({ draftId: "d_new", brandSlug: "cosmicpath", renderSpec: { composition: "TikTokExplainer" } });
  });

  it("does not create a second draft on the same day", async () => {
    db.draft.findFirst.mockResolvedValue(null);
    db.draft.count.mockResolvedValueOnce(1);
    expect((await (await next(nextRequest())).json()).job).toBeNull();
    expect(db.draft.create).not.toHaveBeenCalled();
  });

  it("turns a rendered video into a NEEDS_REVIEW post carrying the mp4", async () => {
    db.draft.findUnique.mockResolvedValue({ id: "d1", brandId: "b1", status: "RENDERING", spokenHook: "훅", cta: "프로필 확인", formatId: "fmt", campaignId: "c", title: "t" });
    const body = await (await complete(completeRequest({ draftId: "d1", videoUrl: "https://blob.example/v.mp4" }))).json();
    expect(body).toMatchObject({ success: true, postId: "p1" });
    expect(db.post.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      status: "NEEDS_REVIEW", imageUrls: JSON.stringify(["https://blob.example/v.mp4"]), content: "훅\n\n프로필 확인",
    }) });
  });

  it("marks the draft FAILED instead of creating a post when no valid video url comes back", async () => {
    db.draft.findUnique.mockResolvedValue({ id: "d1", status: "RENDERING" });
    await complete(completeRequest({ draftId: "d1", error: "chromium crashed" }));
    expect(db.draft.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "FAILED" }) }));
    expect(db.post.create).not.toHaveBeenCalled();
  });
});
