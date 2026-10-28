import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    post: { update: vi.fn(async ({ data }) => ({ id: "p1", ...data })), delete: vi.fn(async () => ({ id: "p1" })) },
    reviewDecision: { create: vi.fn(async ({ data }) => ({ id: "d1", ...data })) },
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
