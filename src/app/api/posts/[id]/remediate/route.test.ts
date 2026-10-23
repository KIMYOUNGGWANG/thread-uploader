// src/app/api/posts/[id]/remediate/route.test.ts — Unit tests for post remediation route.
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  requirePostForCurrentUser: vi.fn(),
  updatePost: vi.fn(async ({ data }) => ({ id: "post_1", ...data })),
  remediatePostAlgorithmic: vi.fn(),
  judgeEnglishNaturalness: vi.fn(async () => ({ natural: true, reason: "" })),
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

vi.mock("@/lib/english-naturalness", () => ({
  judgeEnglishNaturalness: mocks.judgeEnglishNaturalness,
}));

vi.mock("@/lib/quality-gate", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/quality-gate")>();
  return { ...actual, checkQuality: vi.fn(actual.checkQuality) };
});

import { checkQuality } from "@/lib/quality-gate";

const PASSING_BODY =
  "퇴사해야 할지 버틸지 모르겠다면\nA. 버팀형 B. 이동형 C. 준비형 중 가까운 쪽만 체크해. 저장해두고 다음 선택 전에 다시 봐.";
const LEAK_LINE = "자기분류 셀프체크형 포스트입니다. 실제 투자/이직 결정 타이밍을 앞둔 독자가";

function mockPostAndRewrite(content: string, qualityProfile = "career_decision") {
  mocks.requirePostForCurrentUser.mockResolvedValue({
    post: {
      id: "post_1",
      content: "기존 본문",
      firstComment: null,
      algorithmicScore: 65,
      qualityPass: false,
      qualityProfile,
    },
    brand: { id: "brand_1", brandConfig: JSON.stringify({ minAlgorithmicScore: 80 }) },
  });
  mocks.remediatePostAlgorithmic.mockResolvedValue({
    content,
    firstComment: null,
    pass: true,
    method: "targeted_llm_rewrite",
    rewriteCount: 1,
    scoreResult: { totalScore: 88, dimensions: {} },
    actionableFixes: [],
  });
}

async function callRemediate() {
  const { POST } = await import("./route");
  return POST(
    new Request("http://localhost/api/posts/post_1/remediate", { method: "POST" }) as never,
    { params: Promise.resolve({ id: "post_1" }) }
  );
}

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
      content: PASSING_BODY,
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
          content: PASSING_BODY,
          firstComment: "첫 댓글 https://example.com",
          algorithmicScore: 88,
          algorithmicPass: true,
          status: "PENDING",
        }),
      })
    );
  });

  it("keeps NEEDS_REVIEW and qualityPass unchanged when the rewrite passes the score but fails the content gate", async () => {
    mockPostAndRewrite(`${PASSING_BODY}\n${LEAK_LINE}`);

    const response = await callRemediate();

    expect(response.status).toBe(200);
    const data = mocks.updatePost.mock.calls[0][0].data;
    expect(data.status).toBe("NEEDS_REVIEW");
    expect(data.qualityPass).toBe(false);
    const body = await response.json();
    expect(body.remediation.pass).toBe(false);
  });

  it("queues the post when both the score and the content gate pass", async () => {
    mockPostAndRewrite(PASSING_BODY);

    const response = await callRemediate();

    const data = mocks.updatePost.mock.calls[0][0].data;
    expect(data.status).toBe("PENDING");
    expect(data.qualityPass).toBe(true);
    expect((await response.json()).remediation.pass).toBe(true);
    // Korean post: the English naturalness judge is not called
    expect(mocks.judgeEnglishNaturalness).not.toHaveBeenCalled();
  });

  it("keeps an English rewrite in NEEDS_REVIEW when the naturalness judge flags it", async () => {
    const english = "Most people actually choose the safe job, instead, and call it maturity.\n\nA) I stayed\nB) I left\n\nWhich one are you?";
    mockPostAndRewrite(english, "ecommerce_d2c");
    vi.mocked(checkQuality).mockReturnValueOnce({ pass: true, score: 5, profile: "ecommerce_d2c", reasons: [] });
    mocks.judgeEnglishNaturalness.mockResolvedValueOnce({ natural: false, reason: "stacked hedge" });

    const response = await callRemediate();

    expect(mocks.judgeEnglishNaturalness).toHaveBeenCalledWith(english);
    const data = mocks.updatePost.mock.calls[0][0].data;
    expect(data.status).toBe("NEEDS_REVIEW");
    expect(data.qualityPass).toBe(false);
    expect((await response.json()).remediation.pass).toBe(false);
  });

  it("queues an English rewrite the naturalness judge accepts", async () => {
    mockPostAndRewrite("Most people stay in the safe job.\n\nA) I stayed\nB) I left\n\nWhich one are you?", "ecommerce_d2c");
    vi.mocked(checkQuality).mockReturnValueOnce({ pass: true, score: 5, profile: "ecommerce_d2c", reasons: [] });

    await callRemediate();

    expect(mocks.judgeEnglishNaturalness).toHaveBeenCalledTimes(1);
    expect(mocks.updatePost.mock.calls[0][0].data.status).toBe("PENDING");
  });
});
