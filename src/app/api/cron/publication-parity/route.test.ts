import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/prisma", () => ({ prisma: { post: { findMany: vi.fn() } } }));

import { prisma } from "@/lib/prisma";
import { GET } from "./route";

const url = "http://x/api/cron/publication-parity";
const authed = () => new NextRequest(url, { headers: { authorization: "Bearer s3cret" } });

const basePost = {
  id: "p1", brandId: "b1", status: "PUBLISHED", threadsId: "t1", publishedAt: new Date(), errorLog: null,
  threadRootId: "t1", threadPartIds: "[]", threadPartsPosted: 1, threadTotalParts: 1,
  views: 5, likes: null, replies: null, reposts: null, metricsAt: null,
  instagramStatus: null, instagramContainerId: null, instagramMediaId: null,
  instagramPublishedAt: null, instagramAttempts: 0, instagramError: null,
  publications: [] as { status: string; externalId: string | null; views: number | null; channelAccount: { platform: string } }[],
};

describe("GET /api/cron/publication-parity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("CRON_SECRET", "s3cret");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("rejects calls without the cron secret", async () => {
    const res = await GET(new NextRequest(url));
    expect(res.status).toBe(401);
    expect(prisma.post.findMany).not.toHaveBeenCalled();
  });

  it("reports a post whose Threads publication is missing", async () => {
    vi.mocked(prisma.post.findMany).mockResolvedValueOnce([basePost] as never);
    const res = await GET(authed());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      checked: 2,
      mismatches: [{ postId: "p1", platform: "threads", diffs: ["missing publication"] }],
    });
  });

  it("reports nothing when the stored publication matches", async () => {
    const post = {
      ...basePost,
      publications: [{ status: "PUBLISHED", externalId: "t1", views: 5, channelAccount: { platform: "threads" } }],
    };
    vi.mocked(prisma.post.findMany).mockResolvedValueOnce([post] as never);
    expect(await (await GET(authed())).json()).toEqual({ checked: 2, mismatches: [] });
  });

  it("returns a JSON 500 when the query throws", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.mocked(prisma.post.findMany).mockRejectedValueOnce(new Error("boom"));
    const res = await GET(authed());
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "boom" });
  });
});
