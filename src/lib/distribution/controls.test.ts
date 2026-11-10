import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  draftFind: vi.fn(),
  draftUpdate: vi.fn((args: unknown) => args),
  uploadFind: vi.fn(),
  uploadUpdate: vi.fn(),
  uploadUpdateMany: vi.fn((args: unknown) => args),
  transaction: vi.fn(async (ops: unknown[]) => ops),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    videoDraft: { findUnique: db.draftFind, update: db.draftUpdate },
    channelUpload: { findUnique: db.uploadFind, update: db.uploadUpdate, updateMany: db.uploadUpdateMany },
    $transaction: db.transaction,
  },
}));

import { applyDraftAction, applyUploadAction } from "./controls";

const now = new Date("2026-11-09T03:00:00Z");

beforeEach(() => vi.clearAllMocks());

describe("applyDraftAction", () => {
  it("cancels a draft whose uploads have not started", async () => {
    db.draftFind.mockResolvedValueOnce({ status: "COMPLETED", canceledAt: null, autoPublishAt: now, uploads: [] });
    expect(await applyDraftAction("d1", "cancel", now)).toEqual({ ok: true });
    expect(db.draftUpdate).toHaveBeenCalledWith({ where: { id: "d1" }, data: { canceledAt: now } });
  });

  it("refuses to cancel once a channel upload started", async () => {
    db.draftFind.mockResolvedValueOnce({ status: "COMPLETED", canceledAt: null, autoPublishAt: now, uploads: [{ status: "PUBLISHED" }] });
    expect(await applyDraftAction("d1", "cancel", now)).toMatchObject({ ok: false, status: 409 });
  });

  it("resumes a canceled draft whose window already closed at now", async () => {
    db.draftFind.mockResolvedValueOnce({ status: "COMPLETED", canceledAt: now, autoPublishAt: new Date(now.getTime() - 1000), uploads: [] });
    expect(await applyDraftAction("d1", "resume", now)).toEqual({ ok: true });
    expect(db.draftUpdate).toHaveBeenCalledWith({ where: { id: "d1" }, data: { canceledAt: null, autoPublishAt: now } });
  });

  it("publish_now pulls the window to now unless canceled", async () => {
    db.draftFind.mockResolvedValueOnce({ status: "COMPLETED", canceledAt: null, autoPublishAt: new Date(now.getTime() + 3600_000), uploads: [] });
    expect(await applyDraftAction("d1", "publish_now", now)).toEqual({ ok: true });
    expect(db.draftUpdate).toHaveBeenCalledWith({ where: { id: "d1" }, data: { autoPublishAt: now } });

    db.draftFind.mockResolvedValueOnce({ status: "COMPLETED", canceledAt: now, autoPublishAt: now, uploads: [] });
    expect(await applyDraftAction("d1", "publish_now", now)).toMatchObject({ ok: false, status: 409 });
  });
});

describe("applyUploadAction", () => {
  it("cancels only queued uploads", async () => {
    db.uploadFind.mockResolvedValue({ status: "QUEUED", platformData: "{}" });
    db.uploadUpdateMany.mockResolvedValueOnce({ count: 1 });
    expect(await applyUploadAction("u1", "cancel", now)).toEqual({ ok: true });
    db.uploadUpdateMany.mockResolvedValueOnce({ count: 0 });
    expect(await applyUploadAction("u1", "cancel", now)).toMatchObject({ ok: false, status: 409 });
  });

  it("retry resets attempts and platform state", async () => {
    db.uploadFind.mockResolvedValue({ status: "FAILED", platformData: "{}" });
    db.uploadUpdateMany.mockResolvedValueOnce({ count: 1 });
    expect(await applyUploadAction("u1", "retry", now)).toEqual({ ok: true });
    expect(db.uploadUpdateMany.mock.calls[0][0]).toMatchObject({
      where: { id: "u1", status: { in: ["FAILED", "CANCELED"] } },
      data: { status: "QUEUED", attempts: 0, platformData: "{}", scheduledAt: now },
    });
  });

  it("records that a private TikTok post was made public", async () => {
    db.uploadFind.mockResolvedValue({ status: "PUBLISHED", platformData: JSON.stringify({ publishId: "p1" }) });
    expect(await applyUploadAction("u1", "ack_public", now)).toEqual({ ok: true });
    expect(JSON.parse(db.uploadUpdate.mock.calls[0][0].data.platformData)).toEqual({ publishId: "p1", madePublicAt: now.toISOString() });
  });
});
