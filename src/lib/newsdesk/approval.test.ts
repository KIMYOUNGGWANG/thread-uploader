import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  variantUpdateMany: vi.fn(),
  variantFindUnique: vi.fn(),
  variantCount: vi.fn(),
  itemUpdate: vi.fn(),
  uploadFindUnique: vi.fn(),
  uploadCreate: vi.fn(),
  uploadUpdateMany: vi.fn(),
  uploadCount: vi.fn(),
}));

vi.mock("@/lib/prisma", () => {
  const client = {
    newsVariant: { updateMany: db.variantUpdateMany, findUnique: db.variantFindUnique, count: db.variantCount },
    newsItem: { update: db.itemUpdate },
    channelUpload: { findUnique: db.uploadFindUnique, create: db.uploadCreate, updateMany: db.uploadUpdateMany, count: db.uploadCount },
  };
  // Interactive transactions run the callback against the same mock; a throw stands for a rollback.
  return { prisma: { ...client, $transaction: (fn: (tx: typeof client) => unknown) => fn(client) } };
});

import {
  approveVariant, isApproved, markKakaoSent, queueNewsUpload, setNewsMedia, setVariantText, unlockVariant,
} from "./approval";

const now = new Date("2026-11-19T03:00:00Z");
const variant = (over: Record<string, unknown> = {}) => ({
  id: "v1", newsItemId: "n1", platform: "telegram", text: "승인한 글", revision: 2, approvedRevision: 2, lockedAt: null, ...over,
});

beforeEach(() => {
  vi.resetAllMocks();
  db.itemUpdate.mockResolvedValue({ brandId: "b1", media: '[{"url":"https://x.public.blob.vercel-storage.com/a.png","sha256":"s","name":"a","bytes":1}]' });
  db.variantUpdateMany.mockResolvedValue({ count: 1 });
  db.uploadUpdateMany.mockResolvedValue({ count: 1 });
  db.uploadCreate.mockResolvedValue({ id: "u-new" });
});

describe("isApproved", () => {
  it("holds only while the approved revision is the current one", () => {
    expect(isApproved({ revision: 3, approvedRevision: 3 })).toBe(true);
    expect(isApproved({ revision: 4, approvedRevision: 3 })).toBe(false);
    expect(isApproved({ revision: 1, approvedRevision: null })).toBe(false);
  });
});

describe("text and approval", () => {
  it("an edit bumps the revision and only applies while unlocked", async () => {
    await setVariantText("v1", "새 글");
    expect(db.variantUpdateMany.mock.calls[0][0]).toEqual({
      where: { id: "v1", lockedAt: null },
      data: { text: "새 글", revision: { increment: 1 } },
    });
    db.variantUpdateMany.mockResolvedValueOnce({ count: 0 });
    expect(await setVariantText("v1", "또")).toMatchObject({ ok: false, status: 409 });
  });

  it("approves only the revision the operator saw", async () => {
    await approveVariant("v1", 3, now);
    expect(db.variantUpdateMany.mock.calls[0][0]).toEqual({
      where: { id: "v1", revision: 3, lockedAt: null },
      data: { approvedRevision: 3, approvedAt: now },
    });
    db.variantUpdateMany.mockResolvedValueOnce({ count: 0 });
    expect(await approveVariant("v1", 2, now)).toMatchObject({ ok: false, status: 409 });
  });
});

describe("setNewsMedia", () => {
  it("revokes every approval by bumping all revisions", async () => {
    db.variantCount.mockResolvedValueOnce(0);
    expect(await setNewsMedia("n1", [])).toEqual({ ok: true, value: undefined });
    expect(db.itemUpdate).toHaveBeenCalledWith({ where: { id: "n1" }, data: { media: "[]" } });
    expect(db.variantUpdateMany).toHaveBeenCalledWith({ where: { newsItemId: "n1" }, data: { revision: { increment: 1 } } });
  });

  it("refuses once any platform started publishing", async () => {
    db.variantCount.mockResolvedValueOnce(1);
    expect(await setNewsMedia("n1", [])).toMatchObject({ ok: false, status: 409 });
    expect(db.variantUpdateMany).not.toHaveBeenCalled();
  });
});

describe("queueNewsUpload", () => {
  const input = { newsItemId: "n1", platform: "telegram" as const, channelAccountId: "acc1", now };

  it("claims the approved variant and creates the upload with the approved text and current media", async () => {
    db.variantFindUnique.mockResolvedValueOnce(variant());
    db.uploadFindUnique.mockResolvedValueOnce(null);
    expect(await queueNewsUpload(input)).toEqual({ ok: true, value: "u-new" });
    expect(db.variantUpdateMany.mock.calls[0][0]).toEqual({
      where: { id: "v1", lockedAt: null, revision: 2, approvedRevision: 2 },
      data: { lockedAt: now },
    });
    expect(db.uploadCreate.mock.calls[0][0].data).toMatchObject({
      brandId: "b1", channelAccountId: "acc1", kind: "post", sourceKey: "news:n1", caption: "승인한 글",
      mediaUrls: '["https://x.public.blob.vercel-storage.com/a.png"]', scheduledAt: now,
    });
  });

  it("refuses unapproved or already locked variants without claiming", async () => {
    db.variantFindUnique.mockResolvedValueOnce(variant({ revision: 3 }));
    expect(await queueNewsUpload(input)).toMatchObject({ ok: false, status: 409 });
    db.variantFindUnique.mockResolvedValueOnce(variant({ lockedAt: now }));
    expect(await queueNewsUpload(input)).toMatchObject({ ok: false, status: 409 });
    expect(db.variantUpdateMany).not.toHaveBeenCalled();
  });

  it("loses the race cleanly when an edit or another tab got there first", async () => {
    db.variantFindUnique.mockResolvedValueOnce(variant());
    db.variantUpdateMany.mockResolvedValueOnce({ count: 0 });
    expect(await queueNewsUpload(input)).toMatchObject({ ok: false, status: 409 });
    expect(db.uploadCreate).not.toHaveBeenCalled();
  });

  it("requeues a failed row only while it is still failed or canceled, clearing its old result", async () => {
    db.variantFindUnique.mockResolvedValueOnce(variant());
    db.uploadFindUnique.mockResolvedValueOnce({ id: "u-old" });
    expect(await queueNewsUpload(input)).toEqual({ ok: true, value: "u-old" });
    const call = db.uploadUpdateMany.mock.calls[0][0];
    expect(call.where).toEqual({ id: "u-old", status: { in: ["FAILED", "CANCELED"] } });
    expect(call.data).toMatchObject({ status: "QUEUED", attempts: 0, platformData: "{}", externalId: null, caption: "승인한 글" });
  });

  it("rolls back (throws inside the transaction) when the existing row is published or running", async () => {
    db.variantFindUnique.mockResolvedValueOnce(variant());
    db.uploadFindUnique.mockResolvedValueOnce({ id: "u-old" });
    db.uploadUpdateMany.mockResolvedValueOnce({ count: 0 });
    expect(await queueNewsUpload(input)).toMatchObject({ ok: false, status: 409 });
  });

  it("does not swallow database errors", async () => {
    db.variantFindUnique.mockRejectedValueOnce(new Error("db down"));
    await expect(queueNewsUpload(input)).rejects.toThrow("db down");
  });
});

describe("kakao and unlock", () => {
  it("marks kakao sent only for the approved revision and locks it", async () => {
    db.variantFindUnique.mockResolvedValueOnce(variant({ platform: "kakao" }));
    expect(await markKakaoSent("n1", now)).toEqual({ ok: true, value: undefined });
    expect(db.variantUpdateMany.mock.calls[0][0].data).toEqual({ lockedAt: now, manualDoneAt: now });
    db.variantFindUnique.mockResolvedValueOnce(variant({ platform: "kakao", approvedRevision: null }));
    expect(await markKakaoSent("n1", now)).toMatchObject({ ok: false, status: 409 });
  });

  it("unlocks only when no upload for that platform is queued, running or published", async () => {
    db.variantFindUnique.mockResolvedValueOnce(variant({ lockedAt: now }));
    db.uploadCount.mockResolvedValueOnce(1);
    expect(await unlockVariant("n1", "telegram")).toMatchObject({ ok: false, status: 409 });
    expect(db.uploadCount.mock.calls[0][0].where).toEqual({
      sourceKey: "news:n1", channelAccount: { platform: "telegram" }, status: { notIn: ["FAILED", "CANCELED"] },
    });

    db.variantFindUnique.mockResolvedValueOnce(variant({ lockedAt: now }));
    db.uploadCount.mockResolvedValueOnce(0);
    expect(await unlockVariant("n1", "telegram")).toEqual({ ok: true, value: undefined });
    expect(db.variantUpdateMany).toHaveBeenCalledWith({ where: { id: "v1" }, data: { lockedAt: null, manualDoneAt: null } });
  });
});
