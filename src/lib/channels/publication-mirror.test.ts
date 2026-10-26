import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    post: { findUnique: vi.fn(), findMany: vi.fn() },
    brand: { findUnique: vi.fn() },
    channelAccount: { findFirst: vi.fn(), create: vi.fn() },
    publication: { upsert: vi.fn() },
  },
}));

vi.mock("@/lib/alert-service", () => ({ sendSystemAlert: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { sendSystemAlert } from "@/lib/alert-service";
import {
  ensureLegacyChannelAccount,
  instagramPublicationFromPost,
  mirrorInstagramFromPost,
  mirrorRecentInstagram,
  mirrorThreadsFromPost,
  threadsPublicationFromPost,
  type InstagramMirrorPost,
  type ThreadsMirrorPost,
} from "./publication-mirror";

function post(over: Partial<ThreadsMirrorPost> = {}): ThreadsMirrorPost {
  return {
    id: "p1", brandId: "b1", status: "PUBLISHED", threadsId: "t1", publishedAt: new Date("2026-10-01T00:00:00Z"),
    errorLog: null, threadRootId: "t1", threadPartIds: "[]", threadPartsPosted: 1, threadTotalParts: 1,
    views: null, likes: null, replies: null, reposts: null, metricsAt: null, ...over,
  };
}

function ig(over: Partial<InstagramMirrorPost> = {}): InstagramMirrorPost {
  return {
    id: "p1", brandId: "b1", instagramStatus: null, instagramContainerId: null, instagramMediaId: null,
    instagramPublishedAt: null, instagramAttempts: 0, instagramError: null, ...over,
  };
}

describe("threadsPublicationFromPost", () => {
  it("maps PUBLISHED with parts and metrics", () => {
    const m = threadsPublicationFromPost(post({ status: "PUBLISHED", threadsId: "t1", threadPartIds: '["t1","t2"]', views: 120 }));
    expect(m?.status).toBe("PUBLISHED");
    expect(m?.externalId).toBe("t1");
    expect(m?.platformData.threadPartIds).toEqual(["t1", "t2"]);
    expect(m?.views).toBe(120);
  });
  it("copies thread platformData, errorLog and metrics fields", () => {
    const metricsAt = new Date("2026-10-02T00:00:00Z");
    const m = threadsPublicationFromPost(post({
      status: "FAILED", threadsId: "t1", errorLog: "boom", threadPartsPosted: 2, threadTotalParts: 3,
      likes: 4, replies: 5, reposts: 6, metricsAt,
    }));
    expect(m).toMatchObject({
      status: "FAILED", errorLog: "boom", likes: 4, replies: 5, reposts: 6, metricsAt,
      platformData: { threadRootId: "t1", threadPartsPosted: 2, threadTotalParts: 3 },
    });
  });
  it("maps PUBLISHING and PARTIAL_PUBLISHED to PUBLISHING", () => {
    expect(threadsPublicationFromPost(post({ status: "PARTIAL_PUBLISHED", threadsId: "t1" }))?.status).toBe("PUBLISHING");
    expect(threadsPublicationFromPost(post({ status: "PUBLISHING", threadsId: null }))?.status).toBe("PUBLISHING");
  });
  it("maps PARTIAL_FAILED with a root post to FAILED", () =>
    expect(threadsPublicationFromPost(post({ status: "PARTIAL_FAILED", threadsId: "t1" }))?.status).toBe("FAILED"));
  it("archives only posts that reached Threads", () => {
    expect(threadsPublicationFromPost(post({ status: "ARCHIVED", threadsId: "t1" }))?.status).toBe("ARCHIVED");
    expect(threadsPublicationFromPost(post({ status: "ARCHIVED", threadsId: null }))).toBeNull();
  });
  it("skips FAILED without a root post and unpublished states", () => {
    expect(threadsPublicationFromPost(post({ status: "FAILED", threadsId: null }))).toBeNull();
    expect(threadsPublicationFromPost(post({ status: "PENDING", threadsId: null }))).toBeNull();
  });
  it("survives malformed threadPartIds", () => {
    expect(threadsPublicationFromPost(post({ status: "PUBLISHED", threadsId: "t1", threadPartIds: "oops" }))?.platformData.threadPartIds).toEqual([]);
    expect(threadsPublicationFromPost(post({ status: "PUBLISHED", threadsId: "t1", threadPartIds: '{"a":1}' }))?.platformData.threadPartIds).toEqual([]);
  });
});

describe("instagramPublicationFromPost", () => {
  it("maps PROCESSING to PUBLISHING", () => expect(instagramPublicationFromPost(ig({ instagramStatus: "PROCESSING" }))?.status).toBe("PUBLISHING"));
  it("keeps PUBLISHED / FAILED / SKIPPED names", () => {
    for (const s of ["PUBLISHED", "FAILED", "SKIPPED"] as const) {
      expect(instagramPublicationFromPost(ig({ instagramStatus: s }))?.status).toBe(s);
    }
  });
  it("copies instagram fields and leaves metrics null", () => {
    const at = new Date("2026-10-03T00:00:00Z");
    expect(instagramPublicationFromPost(ig({
      instagramStatus: "PUBLISHED", instagramContainerId: "c1", instagramMediaId: "m1",
      instagramPublishedAt: at, instagramAttempts: 2, instagramError: "e",
    }))).toEqual({
      status: "PUBLISHED", externalId: "m1", publishedAt: at, platformData: { containerId: "c1" },
      attempts: 2, errorLog: "e", views: null, likes: null, replies: null, reposts: null, metricsAt: null,
    });
  });
  it("maps a retry reset to QUEUED", () => expect(instagramPublicationFromPost(ig({ instagramStatus: null, instagramAttempts: 1 }))?.status).toBe("QUEUED"));
  it("ignores untouched posts", () => expect(instagramPublicationFromPost(ig({ instagramStatus: null, instagramAttempts: 0 }))).toBeNull());
});

describe("ensureLegacyChannelAccount", () => {
  beforeEach(() => vi.resetAllMocks());

  it("reuses the existing row for a brand without threadsUserId", async () => {
    vi.mocked(prisma.brand.findUnique).mockResolvedValue({ threadsUserId: null, accessToken: "enc" } as never);
    vi.mocked(prisma.channelAccount.findFirst).mockResolvedValue({ id: "ca1" } as never);
    await expect(ensureLegacyChannelAccount("b1", "threads")).resolves.toBe("ca1");
    expect(prisma.channelAccount.create).not.toHaveBeenCalled();
  });

  it("creates a direct account without tokens when none exists", async () => {
    const connectedAt = new Date("2026-09-01T00:00:00Z");
    vi.mocked(prisma.brand.findUnique).mockResolvedValue({
      instagramUserId: "ig1", instagramUsername: "me", instagramConnectedAt: connectedAt,
    } as never);
    vi.mocked(prisma.channelAccount.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.channelAccount.create).mockResolvedValue({ id: "ca2" } as never);
    await expect(ensureLegacyChannelAccount("b1", "instagram")).resolves.toBe("ca2");
    expect(prisma.channelAccount.create).toHaveBeenCalledWith({
      data: { brandId: "b1", platform: "instagram", mode: "direct", externalUserId: "ig1", handle: "me", connectedAt },
      select: { id: true },
    });
  });
});

describe("mirror functions", () => {
  const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

  beforeEach(() => {
    vi.resetAllMocks();
    consoleError.mockImplementation(() => {});
    vi.mocked(sendSystemAlert).mockResolvedValue(true);
    vi.mocked(prisma.post.findUnique).mockResolvedValue(post() as never);
    vi.mocked(prisma.brand.findUnique).mockResolvedValue({ threadsUserId: "u1" } as never);
    vi.mocked(prisma.channelAccount.findFirst).mockResolvedValue({ id: "ca1" } as never);
  });

  it("upserts on (postId, channelAccountId) so a resumed publish stays one row", async () => {
    await mirrorThreadsFromPost("p1");
    expect(prisma.publication.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { postId_channelAccountId: { postId: "p1", channelAccountId: "ca1" } },
    }));
  });

  it("serializes platformData as JSON in create and update", async () => {
    await mirrorThreadsFromPost("p1");
    const arg = vi.mocked(prisma.publication.upsert).mock.calls[0][0];
    expect(arg.create).toMatchObject({ postId: "p1", channelAccountId: "ca1", status: "PUBLISHED", externalId: "t1" });
    expect(JSON.parse(arg.create.platformData as string)).toMatchObject({ threadRootId: "t1" });
    expect(typeof arg.update.platformData).toBe("string");
  });

  it("does nothing when the post maps to no publication", async () => {
    vi.mocked(prisma.post.findUnique).mockResolvedValue(post({ status: "PENDING", threadsId: null }) as never);
    await mirrorThreadsFromPost("p1");
    expect(prisma.publication.upsert).not.toHaveBeenCalled();
  });

  it("mirrors instagram state", async () => {
    vi.mocked(prisma.post.findUnique).mockResolvedValue(ig({ instagramStatus: "PUBLISHED", instagramMediaId: "m1" }) as never);
    await mirrorInstagramFromPost("p1");
    expect(prisma.publication.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ status: "PUBLISHED", externalId: "m1" }),
    }));
  });

  it("logs and swallows a database failure", async () => {
    vi.mocked(prisma.publication.upsert).mockRejectedValueOnce(new Error("db down"));
    await expect(mirrorThreadsFromPost("p1")).resolves.toBeUndefined();
    expect(consoleError).toHaveBeenCalledWith(expect.stringContaining("[publication-mirror]"), "p1", expect.any(Error));
  });

  it("raises a warning alert once when the write fails", async () => {
    vi.mocked(prisma.publication.upsert).mockRejectedValueOnce(new Error("db down"));
    await mirrorThreadsFromPost("p1");
    expect(sendSystemAlert).toHaveBeenCalledTimes(1);
    expect(sendSystemAlert).toHaveBeenCalledWith({
      level: "warning", title: "Publication write failed", message: "threads p1: db down",
    });
  });

  it("still resolves when the alert itself rejects", async () => {
    vi.mocked(prisma.publication.upsert).mockRejectedValueOnce(new Error("db down"));
    vi.mocked(sendSystemAlert).mockRejectedValueOnce(new Error("webhook down"));
    await expect(mirrorThreadsFromPost("p1")).resolves.toBeUndefined();
  });

  it("alerts for instagram and for the recent-instagram selection with the brand id", async () => {
    vi.mocked(prisma.post.findUnique).mockRejectedValueOnce("plain failure");
    await mirrorInstagramFromPost("p1");
    expect(sendSystemAlert).toHaveBeenLastCalledWith(expect.objectContaining({ message: "instagram p1: plain failure" }));
    vi.mocked(prisma.post.findMany).mockRejectedValueOnce(new Error("db down"));
    await mirrorRecentInstagram("b1", new Date());
    expect(sendSystemAlert).toHaveBeenLastCalledWith(expect.objectContaining({ message: "instagram b1: db down" }));
  });

  it("swallows a failure while reading the post", async () => {
    vi.mocked(prisma.post.findUnique).mockRejectedValueOnce(new Error("db down"));
    await expect(mirrorInstagramFromPost("p1")).resolves.toBeUndefined();
    expect(consoleError).toHaveBeenCalledWith("[publication-mirror] instagram", "p1", expect.any(Error));
  });

  it("selects recent instagram posts by brand, activity and 4-day window, then mirrors each", async () => {
    const now = new Date("2026-10-23T06:00:00Z");
    vi.mocked(prisma.post.findMany).mockResolvedValue([{ id: "p1" }, { id: "p2" }] as never);
    vi.mocked(prisma.post.findUnique).mockResolvedValue(ig({ instagramStatus: "PUBLISHED", instagramMediaId: "m1" }) as never);
    await mirrorRecentInstagram("b1", now);
    expect(prisma.post.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        brandId: "b1",
        OR: [{ instagramStatus: { not: null } }, { instagramAttempts: { gt: 0 } }],
        publishedAt: { gte: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000) },
      },
    }));
    expect(prisma.publication.upsert).toHaveBeenCalledTimes(2);
  });

  it("swallows a failure while selecting recent instagram posts", async () => {
    vi.mocked(prisma.post.findMany).mockRejectedValueOnce(new Error("db down"));
    await expect(mirrorRecentInstagram("b1", new Date())).resolves.toBeUndefined();
    expect(consoleError).toHaveBeenCalledWith("[publication-mirror] instagram-recent", "b1", expect.any(Error));
  });
});
