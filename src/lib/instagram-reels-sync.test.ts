import { beforeEach, describe, expect, it, vi } from "vitest";

type FindManyArgs = { where: { instagramStatus?: string | null; publishedAt?: { lt?: Date } } };

const db = vi.hoisted(() => ({
  processing: [] as Array<{ id: string; instagramContainerId: string | null; instagramAttempts: number }>,
  stale: [] as Array<{ id: string; imageUrls: string }>,
  candidates: [] as Array<{ id: string; content: string; imageUrls: string; publishedAt: Date | null; instagramAttempts: number }>,
}));
const post = vi.hoisted(() => ({
  findMany: vi.fn(),
  findFirst: vi.fn(),
  update: vi.fn(),
  updateMany: vi.fn(),
}));
const api = vi.hoisted(() => ({
  createReelsContainer: vi.fn(),
  getContainerStatus: vi.fn(),
  publishContainer: vi.fn(),
  getRemainingPublishQuota: vi.fn(),
}));
const sendSystemAlert = vi.hoisted(() => vi.fn());
const mirrorRecentInstagram = vi.hoisted(() => vi.fn());
const transaction = vi.hoisted(() => ({ active: false, executeRaw: vi.fn(), run: vi.fn() }));

vi.mock("@/lib/prisma", () => ({ prisma: { post, $transaction: transaction.run } }));
vi.mock("@/lib/instagram-api", () => api);
vi.mock("@/lib/alert-service", () => ({ sendSystemAlert }));
vi.mock("@/lib/channels/publication-mirror", () => ({ mirrorRecentInstagram }));

import {
  buildInstagramCaption,
  REEL_STALE_MS,
  runInstagramReelsTick,
  selectReelCandidate,
} from "./instagram-reels-sync";

const HOUR_MS = 60 * 60 * 1000;
const now = new Date("2026-10-23T06:00:00Z"); // 15:00 KST
const connectedAt = new Date("2026-10-20T00:00:00Z");
const credentials = { accessToken: "token", userId: "ig-user" };
const brand = {
  id: "brand-1",
  name: "CosmicPath",
  brandConfig: JSON.stringify({ instagram: { captionSuffix: "#cosmicpath" } }),
  instagramConnectedAt: connectedAt,
};
const VIDEO = JSON.stringify(["https://cdn.example.com/reel.mp4"]);
const hoursAgo = (hours: number) => new Date(now.getTime() - hours * HOUR_MS);
const candidate = (id: string, publishedAt: Date | null, imageUrls = VIDEO) => ({
  id, content: `본문 ${id}`, imageUrls, publishedAt, instagramAttempts: 0,
});

describe("buildInstagramCaption", () => {
  it("buildInstagramCaption appends the suffix after a blank line", () => {
    expect(buildInstagramCaption("본문", "꼬리")).toBe("본문\n\n꼬리");
    expect(buildInstagramCaption("본문", "")).toBe("본문");
  });

  it("buildInstagramCaption keeps the suffix and trims the body to 2200 chars", () => {
    const caption = buildInstagramCaption("가".repeat(3000), "꼬리");
    expect(caption.length).toBe(2200);
    expect(caption.endsWith("\n\n꼬리")).toBe(true);
  });

  it("buildInstagramCaption caps an oversized suffix at 2200 chars instead of throwing", () => {
    expect(buildInstagramCaption("본문", "꼬".repeat(3000)).length).toBe(2200);
  });
});

describe("selectReelCandidate", () => {
  it("selectReelCandidate ignores posts published before connectedAt, older than 3 days, or without video", () => {
    const posts = [
      candidate("before-connect", new Date(connectedAt.getTime() - HOUR_MS)),
      candidate("too-old", new Date(now.getTime() - REEL_STALE_MS - HOUR_MS)),
      candidate("no-video", hoursAgo(2), JSON.stringify(["https://cdn.example.com/a.jpg"])),
      candidate("broken-json", hoursAgo(2), "not json"),
      candidate("unpublished", null),
    ];
    expect(selectReelCandidate(posts, { connectedAt: new Date(now.getTime() - 4 * 24 * HOUR_MS), now })).toBeNull();
    expect(selectReelCandidate([candidate("before-connect", hoursAgo(5))], { connectedAt: hoursAgo(4), now })).toBeNull();
  });

  it("selectReelCandidate picks the earliest published video", () => {
    const posts = [candidate("newer", hoursAgo(1)), candidate("earliest", hoursAgo(20)), candidate("middle", hoursAgo(5))];
    expect(selectReelCandidate(posts, { connectedAt, now })?.id).toBe("earliest");
  });
});

describe("runInstagramReelsTick", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.processing = [];
    db.stale = [];
    db.candidates = [];
    post.findMany.mockImplementation(async ({ where }: FindManyArgs) => {
      if (where.instagramStatus === "PROCESSING") return db.processing;
      return where.publishedAt?.lt ? db.stale : db.candidates;
    });
    post.findFirst.mockResolvedValue(null);
    post.update.mockResolvedValue({});
    post.updateMany.mockResolvedValue({ count: 1 });
    api.getRemainingPublishQuota.mockResolvedValue(null);
    api.createReelsContainer.mockResolvedValue("container-new");
    transaction.executeRaw.mockResolvedValue(0);
    transaction.run.mockImplementation(async (callback: (client: unknown) => Promise<unknown>) => {
      transaction.active = true;
      try {
        return await callback({ post, $executeRaw: transaction.executeRaw });
      } finally {
        transaction.active = false;
      }
    });
  });

  it("publishes a FINISHED container and records media id", async () => {
    db.processing = [{ id: "p1", instagramContainerId: "c1", instagramAttempts: 0 }];
    db.candidates = [candidate("p2", hoursAgo(1))];
    api.getContainerStatus.mockResolvedValue("FINISHED");
    api.publishContainer.mockResolvedValue("media-1");

    const result = await runInstagramReelsTick(brand, credentials, now);

    expect(api.getContainerStatus).toHaveBeenCalledWith("c1", "token");
    expect(api.publishContainer).toHaveBeenCalledWith(credentials, "c1");
    expect(post.update).toHaveBeenCalledWith({
      where: { id: "p1" },
      data: { instagramStatus: "PUBLISHED", instagramMediaId: "media-1", instagramPublishedAt: now, instagramError: null },
    });
    expect(result.published).toEqual(["p1"]);
    expect(result.advanced).toBe(1);
    // Already published today: nothing new starts in the same tick.
    expect(result.started).toBeNull();
    expect(api.createReelsContainer).not.toHaveBeenCalled();
  });

  it("keeps the container when publishContainer fails so a timed-out publish is never re-posted", async () => {
    db.processing = [{ id: "p1", instagramContainerId: "c1", instagramAttempts: 0 }];
    db.candidates = [candidate("p1", hoursAgo(10)), candidate("p2", hoursAgo(1))];
    api.getContainerStatus.mockResolvedValue("FINISHED");
    api.publishContainer.mockRejectedValue(new Error("Instagram API Error (publish): timeout"));

    const result = await runInstagramReelsTick(brand, credentials, now);

    expect(post.updateMany).toHaveBeenCalledWith({
      where: { id: "p1", instagramStatus: "PROCESSING" },
      data: { instagramAttempts: 1, instagramError: "Instagram API Error (publish): timeout" },
    });
    const writes = [...post.update.mock.calls, ...post.updateMany.mock.calls].map(([args]) => args.data);
    expect(writes).not.toContainEqual(expect.objectContaining({ instagramContainerId: null }));
    expect(writes).not.toContainEqual(expect.objectContaining({ instagramStatus: null }));
    expect(transaction.run).not.toHaveBeenCalled();
    expect(api.createReelsContainer).not.toHaveBeenCalled();
    expect(sendSystemAlert).not.toHaveBeenCalled();
    expect(result).toMatchObject({ published: [], started: null, failed: ["p1"] });
  });

  it("keeps the container when the status read throws so a timed-out publish is never re-posted", async () => {
    db.processing = [{ id: "p1", instagramContainerId: "c1", instagramAttempts: 1 }];
    db.candidates = [candidate("p1", hoursAgo(10)), candidate("p2", hoursAgo(1))];
    api.getContainerStatus.mockRejectedValue(new Error("Instagram API Error (status check): 503"));

    const result = await runInstagramReelsTick(brand, credentials, now);

    expect(post.updateMany).toHaveBeenCalledWith({
      where: { id: "p1", instagramStatus: "PROCESSING" },
      data: { instagramAttempts: 2, instagramError: "Instagram API Error (status check): 503" },
    });
    const writes = [...post.update.mock.calls, ...post.updateMany.mock.calls].map(([args]) => args.data);
    expect(writes).not.toContainEqual(expect.objectContaining({ instagramContainerId: null }));
    expect(writes).not.toContainEqual(expect.objectContaining({ instagramStatus: null }));
    expect(transaction.run).not.toHaveBeenCalled();
    expect(api.createReelsContainer).not.toHaveBeenCalled();
    expect(result).toMatchObject({ published: [], started: null, failed: ["p1"] });
  });

  it("marks FAILED and alerts when publishContainer fails for the third time", async () => {
    db.processing = [{ id: "p1", instagramContainerId: "c1", instagramAttempts: 2 }];
    api.getContainerStatus.mockResolvedValue("FINISHED");
    api.publishContainer.mockRejectedValue(new Error("Instagram API Error (publish): 500"));

    await runInstagramReelsTick(brand, credentials, now);

    expect(post.updateMany).toHaveBeenCalledWith({
      where: { id: "p1", instagramStatus: "PROCESSING" },
      data: { instagramStatus: "FAILED", instagramAttempts: 3, instagramError: "Instagram API Error (publish): 500" },
    });
    expect(sendSystemAlert).toHaveBeenCalledTimes(1);
  });

  it("leaves IN_PROGRESS containers alone and starts nothing new", async () => {
    db.processing = [{ id: "p1", instagramContainerId: "c1", instagramAttempts: 0 }];
    db.candidates = [candidate("p2", hoursAgo(1))];
    api.getContainerStatus.mockResolvedValue("IN_PROGRESS");

    const result = await runInstagramReelsTick(brand, credentials, now);

    expect(api.publishContainer).not.toHaveBeenCalled();
    expect(post.update).not.toHaveBeenCalled();
    expect(post.updateMany).not.toHaveBeenCalledWith(expect.objectContaining({ where: { id: "p1", instagramStatus: "PROCESSING" } }));
    expect(api.createReelsContainer).not.toHaveBeenCalled();
    expect(result).toMatchObject({ advanced: 0, published: [], started: null, failed: [] });
  });

  it("recovers a claim without container as one failed attempt", async () => {
    db.processing = [{ id: "p1", instagramContainerId: null, instagramAttempts: 0 }];

    const result = await runInstagramReelsTick(brand, credentials, now);

    expect(api.getContainerStatus).not.toHaveBeenCalled();
    expect(post.updateMany).toHaveBeenCalledWith({
      where: { id: "p1", instagramStatus: "PROCESSING" },
      data: expect.objectContaining({ instagramStatus: null, instagramContainerId: null, instagramAttempts: 1 }),
    });
    expect(sendSystemAlert).not.toHaveBeenCalled();
    expect(result.failed).toEqual(["p1"]);
  });

  it("counts an ERROR container as a failed attempt and retries later", async () => {
    db.processing = [{ id: "p1", instagramContainerId: "c1", instagramAttempts: 1 }];
    api.getContainerStatus.mockResolvedValue("ERROR");

    await runInstagramReelsTick(brand, credentials, now);

    expect(post.updateMany).toHaveBeenCalledWith({
      where: { id: "p1", instagramStatus: "PROCESSING" },
      data: expect.objectContaining({ instagramStatus: null, instagramContainerId: null, instagramAttempts: 2 }),
    });
    expect(sendSystemAlert).not.toHaveBeenCalled();
  });

  it("marks FAILED and alerts on the third failure", async () => {
    db.processing = [{ id: "p1", instagramContainerId: "c1", instagramAttempts: 2 }];
    api.getContainerStatus.mockRejectedValue(new Error("Instagram API Error (status check): boom"));

    const result = await runInstagramReelsTick(brand, credentials, now);

    expect(post.updateMany).toHaveBeenCalledWith({
      where: { id: "p1", instagramStatus: "PROCESSING" },
      data: { instagramStatus: "FAILED", instagramAttempts: 3, instagramError: "Instagram API Error (status check): boom" },
    });
    expect(sendSystemAlert).toHaveBeenCalledTimes(1);
    expect(sendSystemAlert).toHaveBeenCalledWith(expect.objectContaining({ level: "error", postId: "p1", brandName: "CosmicPath" }));
    expect(result.failed).toEqual(["p1"]);
  });

  it("marks a container Instagram already published as PUBLISHED without publishing again", async () => {
    db.processing = [{ id: "p1", instagramContainerId: "c1", instagramAttempts: 0 }];
    api.getContainerStatus.mockResolvedValue("PUBLISHED");

    const result = await runInstagramReelsTick(brand, credentials, now);

    expect(api.publishContainer).not.toHaveBeenCalled();
    expect(post.update).toHaveBeenCalledWith({
      where: { id: "p1" },
      data: expect.objectContaining({ instagramStatus: "PUBLISHED", instagramPublishedAt: now }),
    });
    expect(result.published).toEqual(["p1"]);
  });

  it("starts nothing when a reel was already published today (KST)", async () => {
    db.candidates = [candidate("p2", hoursAgo(1))];
    post.findFirst.mockResolvedValue({ id: "p0" });

    const result = await runInstagramReelsTick(brand, credentials, now);

    // KST day for 2026-10-23T06:00Z starts at 2026-10-22T15:00Z.
    expect(post.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        brandId: "brand-1",
        OR: [{ instagramPublishedAt: { gte: new Date("2026-10-22T15:00:00Z") } }, { instagramStatus: "PROCESSING" }],
      },
    }));
    expect(api.createReelsContainer).not.toHaveBeenCalled();
    expect(result.started).toBeNull();
  });

  it("starts nothing when remaining quota is 0", async () => {
    db.candidates = [candidate("p2", hoursAgo(1))];
    api.getRemainingPublishQuota.mockResolvedValue(0);

    const result = await runInstagramReelsTick(brand, credentials, now);

    expect(api.getRemainingPublishQuota).toHaveBeenCalledWith(credentials);
    expect(post.updateMany).not.toHaveBeenCalled();
    expect(api.createReelsContainer).not.toHaveBeenCalled();
    expect(result.started).toBeNull();
  });

  it("starts the earliest eligible reel with the brand caption suffix", async () => {
    db.candidates = [candidate("newer", hoursAgo(1)), candidate("older", hoursAgo(10))];
    api.getRemainingPublishQuota.mockResolvedValue(null);

    const result = await runInstagramReelsTick(brand, credentials, now);

    expect(post.updateMany).toHaveBeenCalledWith({
      where: { id: "older", instagramStatus: null },
      data: { instagramStatus: "PROCESSING" },
    });
    expect(api.createReelsContainer).toHaveBeenCalledWith(credentials, {
      videoUrl: "https://cdn.example.com/reel.mp4",
      caption: "본문 older\n\n#cosmicpath",
    });
    expect(post.update).toHaveBeenCalledWith({ where: { id: "older" }, data: { instagramContainerId: "container-new" } });
    expect(result.started).toBe("older");
  });

  it("serializes the today check and claim per brand with an advisory lock, creating the container outside it", async () => {
    db.candidates = [candidate("p2", hoursAgo(1))];
    let createdInsideTransaction: boolean | null = null;
    api.createReelsContainer.mockImplementation(async () => {
      createdInsideTransaction = transaction.active;
      return "container-new";
    });

    await runInstagramReelsTick(brand, credentials, now);

    expect(transaction.run).toHaveBeenCalledTimes(1);
    const [sqlParts, lockKey] = transaction.executeRaw.mock.calls[0];
    expect(sqlParts.join("?")).toContain("pg_advisory_xact_lock(hashtext(");
    expect(lockKey).toBe("brand-1");
    const lockOrder = transaction.executeRaw.mock.invocationCallOrder[0];
    expect(api.getRemainingPublishQuota.mock.invocationCallOrder[0]).toBeLessThan(lockOrder);
    expect(lockOrder).toBeLessThan(post.findFirst.mock.invocationCallOrder[0]);
    expect(post.findFirst.mock.invocationCallOrder[0]).toBeLessThan(post.updateMany.mock.invocationCallOrder[0]);
    expect(createdInsideTransaction).toBe(false);
  });

  it("claims atomically and stops when another run claimed first", async () => {
    db.candidates = [candidate("p2", hoursAgo(1))];
    post.updateMany.mockResolvedValue({ count: 0 });

    const result = await runInstagramReelsTick(brand, credentials, now);

    expect(post.updateMany).toHaveBeenCalledWith({
      where: { id: "p2", instagramStatus: null },
      data: { instagramStatus: "PROCESSING" },
    });
    expect(api.createReelsContainer).not.toHaveBeenCalled();
    expect(result.started).toBeNull();
  });

  it("counts a container creation failure as one failed attempt", async () => {
    db.candidates = [candidate("p2", hoursAgo(1))];
    api.createReelsContainer.mockRejectedValue(new Error("Instagram API Error (container creation): bad url"));

    const result = await runInstagramReelsTick(brand, credentials, now);

    expect(post.updateMany).toHaveBeenLastCalledWith({
      where: { id: "p2", instagramStatus: "PROCESSING" },
      data: expect.objectContaining({ instagramStatus: null, instagramAttempts: 1 }),
    });
    expect(result).toMatchObject({ started: null, failed: ["p2"] });
  });

  it("marks unposted reels older than 3 days as SKIPPED", async () => {
    db.stale = [
      { id: "old-video", imageUrls: VIDEO },
      { id: "old-image", imageUrls: JSON.stringify(["https://cdn.example.com/a.png"]) },
    ];

    const result = await runInstagramReelsTick(brand, credentials, now);

    expect(post.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        brandId: "brand-1",
        status: "PUBLISHED",
        instagramStatus: null,
        publishedAt: { gte: connectedAt, lt: new Date(now.getTime() - REEL_STALE_MS) },
      },
    }));
    expect(post.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["old-video"] }, instagramStatus: null },
      data: { instagramStatus: "SKIPPED" },
    });
    expect(result.skippedStale).toBe(1);
  });

  it("mirrors recent instagram posts at the end of every tick", async () => {
    db.processing = [{ id: "p1", instagramContainerId: "c1", instagramAttempts: 0 }];
    api.getContainerStatus.mockResolvedValue("FINISHED");
    api.publishContainer.mockResolvedValue("media-1");

    await runInstagramReelsTick(brand, credentials, now);

    expect(mirrorRecentInstagram).toHaveBeenCalledWith(brand.id, now);
    expect(mirrorRecentInstagram.mock.invocationCallOrder[0]).toBeGreaterThan(post.update.mock.invocationCallOrder[0]);
  });

  it("still mirrors once when the tick published nothing", async () => {
    await runInstagramReelsTick(brand, credentials, now);

    expect(mirrorRecentInstagram).toHaveBeenCalledTimes(1);
  });
});
