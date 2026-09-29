// src/app/api/posts/[id]/remediate/route.test.ts — Unit tests for post remediation route.
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  requirePostForCurrentUser: vi.fn(),
  updatePost: vi.fn(async ({ data }) => ({ id: "post_1", ...data })),
  remediatePostAlgorithmic: vi.fn(),
}));

vi.mock("@/lib/brand-access", () => ({
  accessErrorResponse: (err: unknown) =>
    err instanceof Error && err.message === "UNAUTHORIZED"
      ? new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })
      : null,
  requirePostForCurrentUser: mocks.requirePostForCurrentUser,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    post: {
      update: mocks.updatePost,
    },
  },
}));

vi.mock("@/lib/remediation-engine", () => ({
  remediatePostAlgorithmic: mocks.remediatePostAlgorithmic,
}));

describe("POST /api/posts/[id]/remediate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when unauthorized", async () => {
    mocks.requirePostForCurrentUser.mockRejectedValue(new Error("UNAUTHORIZED"));

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/posts/p1/remediate", { method: "POST" }) as never,
      { params: Promise.resolve({ id: "p1" }) }
    );

    expect(response.status).toBe(401);
  });

  it("remediates post and returns synchronized beforeScore and afterScore", async () => {
    mocks.requirePostForCurrentUser.mockResolvedValue({
      post: {
        id: "post_1",
        content: "기존 본문 https://example.com",
        firstComment: null,
        algorithmicScore: 65,
        qualityPass: false,
      },
      brand: {
        id: "brand_1",
        brandConfig: JSON.stringify({ minAlgorithmicScore: 80 }),
      },
    });

    mocks.remediatePostAlgorithmic.mockResolvedValue({
      content: "치유된 본문",
      firstComment: "첫 댓글 https://example.com",
      pass: true,
      method: "targeted_llm_rewrite",
      rewriteCount: 1,
      scoreResult: {
        totalScore: 88,
        dimensions: {
          hookTension: { score: 22, maxScore: 25 },
          conversationDepth: { score: 23, maxScore: 25 },
          humanVoice: { score: 18, maxScore: 20 },
          penaltyRisk: { score: 13, maxScore: 15 },
          formatReadability: { score: 12, maxScore: 15 },
        },
      },
      actionableFixes: [],
    });

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/posts/post_1/remediate", { method: "POST" }) as never,
      { params: Promise.resolve({ id: "post_1" }) }
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.beforeScore).toBe(65);
    expect(body.afterScore).toBe(88);
    expect(body.post.status).toBe("PENDING");
    expect(body.remediation.newScore).toBe(88);
    expect(body.remediation.method).toBe("targeted_llm_rewrite");

    expect(mocks.updatePost).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "post_1" },
        data: expect.objectContaining({
          content: "치유된 본문",
          firstComment: "첫 댓글 https://example.com",
          algorithmicScore: 88,
          algorithmicPass: true,
          status: "PENDING",
        }),
      })
    );
  });
});
