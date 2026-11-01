import { describe, expect, it, vi } from "vitest";

const create = vi.fn();
vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = { create };
  },
}));

import { chainDraftsByTone, judgeTone, parseToneVerdict } from "@/lib/tone-judge";

const fakeDrafts = (posts: Array<{ post: string; pass?: boolean }>) => {
  const feedbacks: string[][] = [];
  let i = 0;
  const draft = vi.fn(async (feedback: string[]) => {
    feedbacks.push(feedback);
    const { post, pass = true } = posts[i++];
    return { result: { post, firstComment: "" }, gate: { pass } };
  });
  return { draft, feedbacks };
};
const scores = (map: Record<string, number | null>) => async (post: string) => ({ score: map[post], fixes: ["반말로"] });

describe("chainDraftsByTone", () => {
  it("chains each draft on the earlier openers and keeps the best tone", async () => {
    const { draft, feedbacks } = fakeDrafts([{ post: "A 첫줄\n본문" }, { post: "B" }, { post: "C" }]);
    const best = await chainDraftsByTone(3, draft, scores({ "A 첫줄\n본문": 82, B: 95, C: 88 }));
    expect(best.result.post).toBe("B");
    expect(best.tone.score).toBe(95);
    expect(feedbacks[0]).toEqual([]);
    expect(feedbacks[2][0]).toContain('"A 첫줄", "B"');
    expect(draft).toHaveBeenCalledTimes(3);
  });

  it("rewrites a below-bar winner and only swaps in a higher-scoring, gate-passing rewrite", async () => {
    const { draft, feedbacks } = fakeDrafts([{ post: "A" }, { post: "B", pass: false }, { post: "R1", pass: false }, { post: "R2" }]);
    const best = await chainDraftsByTone(2, draft, scores({ A: 60, R2: 85 }));
    expect(best.result.post).toBe("R2");
    expect(feedbacks[2][0]).toContain('"""A"""');
    expect(feedbacks[2]).toContain("톤 수정: 반말로");
  });

  it("keeps the original when rewrites score lower", async () => {
    const { draft } = fakeDrafts([{ post: "A" }, { post: "R1" }, { post: "R2" }]);
    const best = await chainDraftsByTone(1, draft, scores({ A: 70, R1: 65, R2: 50 }));
    expect(best.result.post).toBe("A");
  });

  it("returns the failed last draft when none passes the gate", async () => {
    const { draft } = fakeDrafts([{ post: "A", pass: false }, { post: "B", pass: false }]);
    const best = await chainDraftsByTone(2, draft, scores({}));
    expect(best.gate.pass).toBe(false);
    expect(best.result.post).toBe("B");
  });
});

describe("parseToneVerdict", () => {
  it("reads the score and up to three fixes", () => {
    expect(parseToneVerdict('{"score": 72, "fixes": ["~합니다 → 반말로", "", "a", "b", "c"]}')).toEqual({
      score: 72,
      fixes: ["~합니다 → 반말로", "a", "b"],
    });
  });

  it("extracts JSON wrapped in a code fence", () => {
    expect(parseToneVerdict('```json\n{"score": 91, "fixes": []}\n```')).toEqual({ score: 91, fixes: [] });
  });

  it("keeps the score and closed fixes when the reply is cut off at the token cap", () => {
    expect(parseToneVerdict('{"score": 82, "fixes": ["\\"먹은 거임\\" → 단정형으로", "클로징이 코칭 톤 → 단언형으로 바꿔')).toEqual({
      score: 82,
      fixes: ['"먹은 거임" → 단정형으로'],
    });
    expect(parseToneVerdict('{"score": 74, "fi')).toEqual({ score: 74, fixes: [] });
  });

  it("fails open on unparseable or out-of-range scores", () => {
    expect(parseToneVerdict("좋아요").score).toBeNull();
    expect(parseToneVerdict('{"score": "80"}').score).toBeNull();
    expect(parseToneVerdict('{"score": 140, "fixes": []}').score).toBeNull();
  });
});

describe("judgeTone", () => {
  it("fails open without an API key", async () => {
    const key = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    await expect(judgeTone("글", "댓글", { systemPrompt: "반말" })).resolves.toEqual({ score: null, fixes: [] });
    process.env.ANTHROPIC_API_KEY = key;
  });
});
