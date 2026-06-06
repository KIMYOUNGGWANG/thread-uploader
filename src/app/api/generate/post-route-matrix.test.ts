import { describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  createdPosts: [] as Array<{ id: string; campaignFormulaId: string | null }>,
}));

vi.mock("@anthropic-ai/sdk", () => ({
  default: class MockAnthropic {
    messages = {
      create: vi.fn(async () => ({
        content: [{
          type: "text",
          text: "이직할지 버틸지 헷갈릴 때 A/B/C 중 하나만 체크해봐.\n\nA. 버팀형\nB. 이동형\nC. 준비형\n\n#커리어\n===FIRST_COMMENT===\n저장해두고 다음 선택 전에 다시 봐.",
        }],
      })),
    };
  },
}));

vi.mock("@/lib/brand-access", () => ({
  accessErrorResponse: () => null,
  requireBrandForCurrentUser: vi.fn(async () => ({
    brand: {
      id: "brand_1",
      brandConfig: JSON.stringify({
        systemPrompt: "Write concise CosmicPath posts.",
        topics: ["이직 타이밍"],
        targets: ["이직을 고민하는 사람"],
        situations: ["퇴사와 이직 사이에서 흔들리는 상황"],
        websiteUrl: "cosmicpath.app",
        campaigns: [{
          id: "career_timing_wedge_399",
          name: "커리어 타이밍 불안 wedge",
          mode: "landing-test",
          qualityProfile: "career_decision",
          landingUrl: "/career/uncertainty",
          utmSource: "threads",
          utmCampaign: "career_timing_wedge_399",
          utmContentTemplate: "{{postId}}",
          dailyPostTarget: 3,
          linkCadenceEvery: 1000,
          linkPlacement: "firstComment",
          formulas: [
            {
              id: "self_classification",
              name: "자기분류 셀프체크형",
              weight: 3,
              instruction: "A/B/C 중 하나를 본문 안에서 체크하게 만든다.",
            },
            {
              id: "saveable_tool",
              name: "저장형 판단 도구",
              weight: 2,
              instruction: "저장 가능한 체크리스트로 만든다.",
            },
            {
              id: "friend_share",
              name: "친구 공유형",
              weight: 2,
              instruction: "친구에게 보내주고 싶게 만든다.",
            },
          ],
          replyPlaybook: {
            stay: "버팀형",
            move: "이동형",
            prepare: "준비형",
            cta: "프로필 링크 확인",
          },
        }],
        activeCampaignId: "career_timing_wedge_399",
        qualityProfile: "career_decision",
      }),
      formulaWeights: "{}",
      growthMemory: "{}",
      viralMemory: "{}",
    },
  })),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    post: {
      findMany: vi.fn(async () => []),
      findFirst: vi.fn(async () => null),
      create: vi.fn(async ({ data }) => {
        const post = {
          id: `post_${state.createdPosts.length}`,
          ...data,
        };
        state.createdPosts.push(post);
        return post;
      }),
      update: vi.fn(async ({ where, data }) => {
        const post = state.createdPosts.find((item) => item.id === where.id);
        return Object.assign(post ?? { id: where.id }, data);
      }),
    },
  },
}));

vi.mock("@/lib/quality-gate", () => ({
  checkQuality: vi.fn(() => ({
    pass: true,
    score: 5,
    profile: "career_decision",
    reasons: [],
    careerDecisionType: "stay",
  })),
}));

describe("POST /api/generate viral sprint matrix", () => {
  it("persists 28 generated campaign posts into four 7-post viral mode buckets", async () => {
    state.createdPosts.length = 0;
    const { POST } = await import("@/app/api/generate/route");

    const response = await POST(new Request("http://localhost/api/generate", {
      method: "POST",
      body: JSON.stringify({
        brandId: "brand_1",
        count: 28,
        campaignId: "career_timing_wedge_399",
      }),
    }) as never);
    const body = await response.json();

    const counts = state.createdPosts.reduce<Record<string, number>>((result, post) => {
      const modeId = post.campaignFormulaId ?? "missing";
      result[modeId] = (result[modeId] ?? 0) + 1;
      return result;
    }, {});

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ success: true, count: 28, campaignId: "career_timing_wedge_399" });
    expect(counts).toEqual({
      self_classification: 7,
      saveable_tool: 7,
      quiet_contrarian: 7,
      friend_share: 7,
    });
  }, 10000);
});
