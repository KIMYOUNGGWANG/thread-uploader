import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { analyzeTopViralExamples, buildViralAnalysisPrompt, parseViralAnalysisResponse } from "@/lib/viral-llm-analysis";

const messagesCreate = vi.hoisted(() => vi.fn());
vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = { create: messagesCreate };
  },
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    viralExample: { findMany: vi.fn(async () => []), update: vi.fn() },
  },
}));

const analysis = {
  id: "ex1",
  hookType: "질문형 훅",
  emotionalDriver: "욕망",
  structureType: "자기분류",
  patternSummary: "로또 당첨 상상 질문 후 3지선다",
  keyTakeaway: "상상 시나리오 + 번호 선택지",
  whyItWorks: "1초 만에 자기 답을 정할 수 있어 댓글이 쉬움",
};

describe("viral LLM analysis", () => {
  it("embeds every post id and the shared label vocabulary in the prompt", () => {
    const prompt = buildViralAnalysisPrompt([{ id: "ex1", content: "자, 상상해봐" }, { id: "ex2", content: "솔직히" }]);
    expect(prompt).toContain('<post id="ex1">');
    expect(prompt).toContain('<post id="ex2">');
    expect(prompt).toContain("질문형 훅");
  });

  it("tells the model not to assert a single unverified cause", () => {
    const prompt = buildViralAnalysisPrompt([{ id: "ex1", content: "자, 상상해봐" }]);
    expect(prompt).toContain("한 가지로 단정하지 말고");
    expect(prompt).toContain("지어내지 않는다");
  });

  it("keeps only complete analyses for requested ids", () => {
    const raw = JSON.stringify({
      analyses: [analysis, { ...analysis, id: "unknown" }, { ...analysis, id: "ex2", whyItWorks: "" }],
    });
    expect(parseViralAnalysisResponse(raw, ["ex1", "ex2"])).toEqual([analysis]);
  });

  it("returns nothing for a malformed payload shape", () => {
    expect(parseViralAnalysisResponse(JSON.stringify({ result: [] }), ["ex1"])).toEqual([]);
  });
});

describe("analyzeTopViralExamples shorts exclusion", () => {
  const originalKey = process.env.ANTHROPIC_API_KEY;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ANTHROPIC_API_KEY = "x";
  });

  afterEach(() => {
    if (originalKey === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = originalKey;
  });

  it("keeps the unanalyzed filter and excludes youtube shorts", async () => {
    await analyzeTopViralExamples("b1");

    expect(prisma.viralExample.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          brandId: "b1",
          NOT: { rawMetrics: { contains: "llmAnalyzedAt" } },
          source: { not: "youtube_shorts" },
        }),
      }),
    );
  });

  it("analyzes the 5 newest-discovered examples with the highest referenceScore", async () => {
    const rows = Array.from({ length: 30 }, (_, index) => ({
      id: `ex${index}`,
      content: `글 ${index}`,
      // ex7 has no score at all and must count as 0.
      rawMetrics: index === 7 ? "{}" : JSON.stringify({ referenceScore: index * 3 % 31 }),
    }));
    vi.mocked(prisma.viralExample.findMany).mockResolvedValueOnce(rows as never);
    messagesCreate.mockResolvedValueOnce({ content: [{ type: "text", text: JSON.stringify({ analyses: [] }) }] });

    await analyzeTopViralExamples("b1");

    expect(prisma.viralExample.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { discoveredAt: "desc" }, take: 30 }),
    );
    const prompt = messagesCreate.mock.calls[0][0].messages[0].content as string;
    const sent = [...prompt.matchAll(/<post id="(ex\d+)">/g)].map((match) => match[1]);
    const expected = [...rows]
      .sort((a, b) => (JSON.parse(b.rawMetrics).referenceScore ?? 0) - (JSON.parse(a.rawMetrics).referenceScore ?? 0))
      .slice(0, 5)
      .map((row) => row.id);
    expect(sent).toEqual(expected);
    expect(sent).toHaveLength(5);
  });
});
