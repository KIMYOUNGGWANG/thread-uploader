import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    post: { update: vi.fn(async ({ data }) => ({ id: "p1", ...data })), delete: vi.fn(async () => ({ id: "p1" })) },
    reviewDecision: { create: vi.fn(async ({ data }) => ({ id: "d1", ...data })) },
    channelUpload: { updateMany: vi.fn(async () => ({ count: 1 })) },
    $transaction: vi.fn(async (operations: Promise<unknown>[]) => Promise.all(operations)),
  },
}));
const reviewedPost = vi.hoisted(() => ({
  id: "p1", brandId: "b1", status: "NEEDS_REVIEW", formulaId: "f1", topic: "이별 타이밍", hookType: "질문형 훅",
}));
vi.mock("@/lib/brand-access", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/brand-access")>();
  return { ...actual, requirePostForCurrentUser: vi.fn(async () => ({ post: reviewedPost })) };
});

import { prisma } from "@/lib/prisma";
import { requirePostForCurrentUser } from "@/lib/brand-access";
import { REQUEUEABLE_POST_STATUSES } from "@/lib/post-status";
import { DELETE, PATCH } from "./route";

function withStatus(status: string) {
  vi.mocked(requirePostForCurrentUser).mockResolvedValueOnce({ post: { ...reviewedPost, status } } as never);
}

function del(body?: Record<string, unknown>) {
  return DELETE(
    new NextRequest("http://localhost/api/posts/p1", { method: "DELETE", ...(body && { body: JSON.stringify(body) }) }),
    { params: Promise.resolve({ id: "p1" }) }
  );
}

function patch(body: Record<string, unknown>) {
  return PATCH(
    new NextRequest("http://localhost/api/posts/p1", { method: "PATCH", body: JSON.stringify(body) }),
    { params: Promise.resolve({ id: "p1" }) }
  );
}

describe("PATCH /api/posts/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects arbitrary status values like PUBLISHED", async () => {
    const res = await patch({ status: "PUBLISHED" });
    expect(res.status).toBe(400);
    expect(prisma.post.update).not.toHaveBeenCalled();
  });

  it("approval to PENDING clears the quality and score gates", async () => {
    await patch({ status: "PENDING" });
    expect(prisma.post.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "PENDING", qualityPass: true, algorithmicPass: true }),
    }));
  });

  it("editing content without approval resets the score pass", async () => {
    await patch({ content: "새 본문" });
    expect(prisma.post.update).toHaveBeenCalledWith(expect.objectContaining({
      data: { content: "새 본문", algorithmicPass: null },
    }));
    expect(prisma.reviewDecision.create).not.toHaveBeenCalled();
  });

  it("approving a NEEDS_REVIEW draft records the decision with its topic and formula", async () => {
    await patch({ status: "PENDING", reason: "  내 얘기라 공감됨  " });
    expect(prisma.reviewDecision.create).toHaveBeenCalledWith({
      data: {
        brandId: "b1", postId: "p1", decision: "APPROVED", reason: "내 얘기라 공감됨",
        formulaId: "f1", topic: "이별 타이밍", hookType: "질문형 훅",
      },
    });
  });

  it("re-saving an already PENDING post does not record a second approval", async () => {
    withStatus("PENDING");
    await patch({ status: "PENDING" });
    expect(prisma.reviewDecision.create).not.toHaveBeenCalled();
  });
});

// The publish cron claims PENDING posts, so moving a post that is in flight, published or archived back to PENDING
// (with qualityPass forced true) used to publish it a second time.
describe("PATCH status guard", () => {
  beforeEach(() => vi.clearAllMocks());

  it.each(["PUBLISHED", "PUBLISHING", "PARTIAL_PUBLISHED", "PARTIAL_FAILED", "PROCESSING", "ARCHIVED"])(
    "refuses to move a %s post back to the queue and records nothing",
    async (status) => {
      withStatus(status);
      const res = await patch({ status: "PENDING" });

      expect(res.status).toBe(409);
      expect(prisma.post.update).not.toHaveBeenCalled();
      expect(prisma.reviewDecision.create).not.toHaveBeenCalled();
    }
  );

  it("still lets a FAILED post be approved back to the queue", async () => {
    withStatus("FAILED");
    const res = await patch({ status: "PENDING" });

    expect(res.status).toBe(200);
    expect(prisma.post.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "PENDING" }),
    }));
  });

  // The snapshot read at the start of the request can be stale: the cron may claim the post before the write.
  it("makes the write itself conditional on the current status, and answers 409 when the post moved on", async () => {
    vi.mocked(prisma.post.update).mockRejectedValueOnce(Object.assign(new Error("Record not found"), { code: "P2025" }));
    const res = await patch({ status: "PENDING" });

    expect(res.status).toBe(409);
    expect(prisma.post.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "p1", status: { in: REQUEUEABLE_POST_STATUSES } },
    }));
  });

  // Card-first brands edit slides and caption of a post that is already PUBLISHED on Threads, to update the
  // carousel still waiting out its cancel window. Only status changes are guarded, not edits.
  it("does not guard edits that leave the status alone", async () => {
    withStatus("PUBLISHED");
    const res = await patch({ instagramCaption: "새 캡션" });

    expect(res.status).toBe(200);
    expect(prisma.post.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "p1" } }));
  });
});

describe("PATCH card-first fields", () => {
  beforeEach(() => vi.clearAllMocks());
  const slides = (n: number) => Array.from({ length: n }, (_, i) => ({ headline: `카드 ${i + 1}`, body: "본문" }));

  it("saves edited slides and Instagram caption", async () => {
    const response = await patch({ cardSlides: slides(8), instagramCaption: "💜새 캡션💜" });
    expect(response.status).toBe(200);
    const data = vi.mocked(prisma.post.update).mock.calls[0][0].data as Record<string, unknown>;
    expect(JSON.parse(data.cardSlides as string)).toHaveLength(8);
    expect(data.instagramCaption).toBe("💜새 캡션💜");
  });

  it("rejects slide sets outside 7-10 cards or with an empty headline", async () => {
    expect((await patch({ cardSlides: slides(6) })).status).toBe(400);
    expect((await patch({ cardSlides: slides(11) })).status).toBe(400);
    expect((await patch({ cardSlides: [...slides(7), { headline: " " }] })).status).toBe(400);
    expect((await patch({ cardSlides: "not an array" })).status).toBe(400);
    expect((await patch({ cardSlides: [...slides(6), { headline: "목록", items: [1, 2] }] })).status).toBe(400);
    expect((await patch({ cardSlides: [...slides(6), { headline: "목록", items: Array(7).fill("항목") }] })).status).toBe(400);
    expect(prisma.post.update).not.toHaveBeenCalled();
  });

  it("re-checks edited card-first text and syncs a still-queued carousel", async () => {
    vi.mocked(requirePostForCurrentUser).mockResolvedValueOnce({
      post: {
        ...reviewedPost, content: "스레드", instagramCaption: "옛 캡션", cardSlides: JSON.stringify(slides(8)),
        qualityReasons: JSON.stringify(["톤 85점", "금지 표현 의심 · 옛 경고"]),
        brand: { brandConfig: JSON.stringify({ wellness: { feeds: [] }, instagram: { captionSuffix: "#웰니스" } }) },
      },
    } as never);
    expect((await patch({ instagramCaption: "이 차로 불면증 개선" })).status).toBe(200);
    const data = vi.mocked(prisma.post.update).mock.calls[0][0].data as Record<string, unknown>;
    const reasons = JSON.parse(data.qualityReasons as string) as string[];
    expect(reasons[0]).toBe("톤 85점");
    expect(reasons).not.toContain("금지 표현 의심 · 옛 경고");
    expect(reasons.some((reason) => reason.includes("불면증 개선"))).toBe(true);
    const upload = vi.mocked(prisma.channelUpload.updateMany).mock.calls[0][0];
    expect(upload.where).toEqual({ postId: "p1", kind: "carousel", status: "QUEUED" });
    expect(upload.data.caption).toBe("이 차로 불면증 개선\n\n#웰니스");
    expect(JSON.parse(upload.data.mediaUrls as string)).toHaveLength(8);
  });
});

describe("DELETE /api/posts/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("records a rejection with the reason, then deletes the draft", async () => {
    const res = await del({ reason: "너무 뻔함" });
    expect(res.status).toBe(200);
    expect(prisma.reviewDecision.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ decision: "REJECTED", reason: "너무 뻔함", formulaId: "f1", topic: "이별 타이밍" }),
    });
    expect(prisma.post.delete).toHaveBeenCalledWith({ where: { id: "p1" } });
  });

  it("still deletes when the caller sends no body (older clients), with a null reason", async () => {
    const res = await del();
    expect(res.status).toBe(200);
    expect(prisma.reviewDecision.create).toHaveBeenCalledWith({ data: expect.objectContaining({ reason: null }) });
    expect(prisma.post.delete).toHaveBeenCalled();
  });

  it("does not record a rejection when cleaning up a published post", async () => {
    withStatus("PUBLISHED");
    await del({ reason: "정리" });
    expect(prisma.reviewDecision.create).not.toHaveBeenCalled();
    expect(prisma.post.delete).toHaveBeenCalled();
  });
});
