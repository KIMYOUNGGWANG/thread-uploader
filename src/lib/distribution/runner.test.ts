import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  findMany: vi.fn(),
  updateMany: vi.fn(),
  update: vi.fn(),
  start: vi.fn(),
  poll: vi.fn(),
  creds: vi.fn(),
  alert: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { channelUpload: { findMany: db.findMany, updateMany: db.updateMany, update: db.update } },
}));
vi.mock("@/lib/alert-service", () => ({ sendSystemAlert: db.alert }));
vi.mock("./accounts", () => ({ getChannelCredentials: db.creds }));
vi.mock("./adapters", () => ({
  CHANNEL_ADAPTERS: { youtube: { kinds: ["video"], start: db.start, poll: db.poll } },
}));

import { INTERRUPTED_MESSAGE, runDueUploads } from "./runner";
import { ChannelApiError } from "./http";

const now = new Date("2026-11-09T03:00:00Z");
const row = (over: Record<string, unknown> = {}) => ({
  id: "u1", brandId: "b1", channelAccountId: "a1", kind: "video", sourceKey: "video:d1", status: "QUEUED",
  privacy: "public", caption: "c", mediaUrls: '["https://blob/v.mp4"]', attempts: 0, platformData: "{}",
  externalId: null, channelAccount: { id: "a1", platform: "youtube", enabled: true }, ...over,
});
const lastUpdate = () => db.update.mock.calls.at(-1)?.[0] as { data: Record<string, unknown> };

beforeEach(() => {
  vi.clearAllMocks();
  db.findMany.mockResolvedValueOnce([]); // interrupted rows
  db.updateMany.mockResolvedValue({ count: 1 });
  db.creds.mockResolvedValue({ accessToken: "t", externalUserId: "u", handle: null });
});

describe("runDueUploads", () => {
  it("claims a queued row as UPLOADING before calling the platform, then stores the result", async () => {
    db.findMany.mockResolvedValueOnce([row()]);
    db.start.mockResolvedValueOnce({ state: "published", externalId: "yt1", externalUrl: "https://y/1" });
    const report = await runDueUploads(now);
    expect(report.published).toBe(1);
    expect(db.updateMany.mock.calls[0][0].data).toMatchObject({ status: "UPLOADING", attempts: { increment: 1 } });
    expect(lastUpdate().data).toMatchObject({ status: "PUBLISHED", externalId: "yt1", publishedAt: now });
  });

  it("skips a row another run already claimed", async () => {
    db.findMany.mockResolvedValueOnce([row()]);
    db.updateMany.mockResolvedValueOnce({ count: 0 });
    expect((await runDueUploads(now)).skipped).toBe(1);
    expect(db.start).not.toHaveBeenCalled();
  });

  it("requeues a transient failure with backoff and fails after the last attempt", async () => {
    db.findMany.mockResolvedValueOnce([row()]);
    db.start.mockRejectedValueOnce(new Error("socket hang up"));
    expect((await runDueUploads(now)).retrying).toBe(1);
    expect(lastUpdate().data).toMatchObject({ status: "QUEUED", nextAttemptAt: new Date(now.getTime() + 10 * 60 * 1000) });

    db.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([row({ attempts: 2 })]);
    db.start.mockRejectedValueOnce(new Error("socket hang up"));
    expect((await runDueUploads(now)).failed).toBe(1);
    expect(lastUpdate().data).toMatchObject({ status: "FAILED" });
    expect(db.alert).toHaveBeenCalled();
  });

  it("fails a permanent error on the first attempt", async () => {
    db.findMany.mockResolvedValueOnce([row()]);
    db.start.mockRejectedValueOnce(new ChannelApiError("bad video", 400, true));
    expect((await runDueUploads(now)).failed).toBe(1);
  });

  it("never re-uploads a row interrupted mid-upload", async () => {
    db.findMany.mockReset();
    db.findMany.mockResolvedValueOnce([row({ status: "UPLOADING" })]).mockResolvedValueOnce([]);
    expect((await runDueUploads(now)).failed).toBe(1);
    expect(lastUpdate().data).toMatchObject({ status: "FAILED", errorLog: INTERRUPTED_MESSAGE });
    expect(db.start).not.toHaveBeenCalled();
  });

  it("keeps polling after a failed status check instead of uploading again", async () => {
    db.findMany.mockResolvedValueOnce([row({ status: "PROCESSING", attempts: 1, platformData: JSON.stringify({ processingSince: now.toISOString() }) })]);
    db.poll.mockRejectedValueOnce(new Error("timeout"));
    expect((await runDueUploads(now)).processing).toBe(1);
    expect(lastUpdate().data).not.toHaveProperty("status");
    expect(db.start).not.toHaveBeenCalled();
  });

  it("restarts from scratch when the platform-side container died", async () => {
    db.findMany.mockResolvedValueOnce([row({ status: "PROCESSING", attempts: 1 })]);
    db.poll.mockRejectedValueOnce(new ChannelApiError("container ERROR", null, false, true));
    expect((await runDueUploads(now)).retrying).toBe(1);
    expect(lastUpdate().data).toMatchObject({ status: "QUEUED", platformData: "{}" });
  });

  it("gives up on processing that lasts more than a day", async () => {
    const since = new Date(now.getTime() - 25 * 60 * 60 * 1000).toISOString();
    db.findMany.mockResolvedValueOnce([row({ status: "PROCESSING", platformData: JSON.stringify({ processingSince: since }) })]);
    expect((await runDueUploads(now)).failed).toBe(1);
    expect(db.poll).not.toHaveBeenCalled();
  });
});
