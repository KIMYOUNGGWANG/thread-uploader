import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requirePostForCurrentUser: vi.fn(),
  updatePost: vi.fn(async ({ data }) => ({ id: "post_1", ...data })),
  publishPostWithCredentials: vi.fn(),
}));

vi.mock("@/lib/brand-access", () => ({
  accessErrorResponse: () => null,
  requirePostForCurrentUser: mocks.requirePostForCurrentUser,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    post: {
      update: mocks.updatePost,
    },
  },
}));

vi.mock("@/lib/threads-api", () => ({
  getFreshBrandCredentials: vi.fn(async () => ({ accessToken: "token", userId: "user" })),
  publishPostWithCredentials: mocks.publishPostWithCredentials,
  publishReplyWithRetryForBrand: vi.fn(),
}));

describe("POST /api/posts/[id]/publish", () => {
  it("blocks stale quality-passing reply-burden posts before publishing", async () => {
    mocks.requirePostForCurrentUser.mockResolvedValue({
      brand: { id: "brand_1" },
      post: {
        id: "post_1",
        status: "PENDING",
        threadsId: null,
        qualityPass: true,
        content: "이직할지 버틸지 모르겠다면 A/B/C 중 골라봐. 댓글에 지금 상황 짧게 써줘. 같이 보자.",
        firstComment: null,
        imageUrls: "[]",
      },
    });
    const { POST } = await import("@/app/api/posts/[id]/publish/route");

    const response = await POST(new Request("http://localhost/api/posts/post_1/publish", {
      method: "POST",
    }) as never, {
      params: Promise.resolve({ id: "post_1" }),
    });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.reasons).toContain("reply-burden CTA 포함");
    expect(mocks.updatePost).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "post_1" },
      data: expect.objectContaining({ qualityPass: false }),
    }));
    expect(mocks.publishPostWithCredentials).not.toHaveBeenCalled();
  });
});
