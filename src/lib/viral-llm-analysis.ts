import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";
import { CLAUDE_TEXT_MODEL, readMessageText } from "@/lib/claude-text";
import { SHORTS_SOURCE } from "@/lib/youtube/shorts-service";

/**
 * Rule-based labels only match fixed keywords, so the strongest references get re-read by Claude
 * to explain why they spread. Labels prefer the rule vocabulary so pattern aggregation stays grouped.
 */

const ANALYSIS_BATCH_SIZE = 5;
// Newest sightings are read first, then the best reference candidates among them are analyzed.
const ANALYSIS_CANDIDATE_POOL = 30;

const LABEL_VOCABULARY = {
  hookType: ["질문형 훅", "반전형 훅", "논쟁형 훅", "고백형 훅", "체크리스트형 훅", "증거형 훅", "공감형 훅"],
  emotionalDriver: ["분노", "불안", "호기심", "소속감", "안도감", "욕망", "공감"],
  structureType: ["자기분류", "저장형 도구", "리스트", "비포애프터", "반전", "짧은 선언", "스토리", "의견 전개", "랭킹 정지", "카드 선택", "말하는 영상", "일간별 체인", "시즌 훅", "상담 유도"],
} as const;

const ANALYSIS_FIELDS = ["id", "hookType", "emotionalDriver", "structureType", "patternSummary", "keyTakeaway", "whyItWorks"] as const;

export interface LlmViralAnalysis {
  id: string;
  hookType: string;
  emotionalDriver: string;
  structureType: string;
  patternSummary: string;
  keyTakeaway: string;
  whyItWorks: string;
}

interface ExampleToAnalyze {
  id: string;
  content: string;
}

const ANALYSIS_SCHEMA = {
  type: "object",
  properties: {
    analyses: {
      type: "array",
      items: {
        type: "object",
        properties: Object.fromEntries(ANALYSIS_FIELDS.map((field) => [field, { type: "string" }])),
        required: [...ANALYSIS_FIELDS],
        additionalProperties: false,
      },
    },
  },
  required: ["analyses"],
  additionalProperties: false,
};

export function buildViralAnalysisPrompt(examples: ExampleToAnalyze[]): string {
  const posts = examples.map((example) => `<post id="${example.id}">\n${example.content}\n</post>`).join("\n\n");
  return `아래는 Threads에서 인기 검색 상위에 오른 글들이다. 각 글이 왜 퍼졌는지 분석하라.

라벨은 가능하면 아래 목록에서 고르고, 어느 것도 맞지 않을 때만 12자 이내의 새 라벨을 만든다.
- hookType: ${LABEL_VOCABULARY.hookType.join(", ")}
- emotionalDriver: ${LABEL_VOCABULARY.emotionalDriver.join(", ")}
- structureType: ${LABEL_VOCABULARY.structureType.join(", ")}

나머지 필드:
- patternSummary: 첫 줄 훅과 전개 구조를 한 문장으로 요약
- keyTakeaway: 다른 주제에도 옮겨 쓸 수 있는 장치 한 문장
- whyItWorks: 독자가 멈추고 반응하게 만든 심리적 이유 한 문장

모든 글에 대해 id를 그대로 돌려준다.

${posts}`;
}

export function parseViralAnalysisResponse(rawText: string, expectedIds: string[]): LlmViralAnalysis[] {
  const parsed: unknown = JSON.parse(rawText);
  if (typeof parsed !== "object" || parsed === null) return [];
  const analyses = (parsed as Record<string, unknown>).analyses;
  if (!Array.isArray(analyses)) return [];
  const allowedIds = new Set(expectedIds);
  return analyses.filter((item): item is LlmViralAnalysis => isAnalysis(item) && allowedIds.has(item.id));
}

function isAnalysis(item: unknown): item is LlmViralAnalysis {
  if (typeof item !== "object" || item === null) return false;
  const record = item as Record<string, unknown>;
  return ANALYSIS_FIELDS.every((field) => typeof record[field] === "string" && String(record[field]).trim().length > 0);
}

async function requestAnalyses(client: Anthropic, examples: ExampleToAnalyze[]): Promise<LlmViralAnalysis[]> {
  const message = await client.messages.create({
    model: CLAUDE_TEXT_MODEL,
    max_tokens: 8000,
    output_config: { format: { type: "json_schema", schema: ANALYSIS_SCHEMA } },
    messages: [{ role: "user", content: buildViralAnalysisPrompt(examples) }],
  });
  return parseViralAnalysisResponse(readMessageText(message), examples.map((example) => example.id));
}

async function saveAnalysis(analysis: LlmViralAnalysis, rawMetrics: string, analyzedAt: string) {
  const previous = parseRawMetrics(rawMetrics);
  await prisma.viralExample.update({
    where: { id: analysis.id },
    data: {
      hookType: analysis.hookType,
      emotionalDriver: analysis.emotionalDriver,
      structureType: analysis.structureType,
      patternSummary: analysis.patternSummary,
      keyTakeaway: analysis.keyTakeaway,
      rawMetrics: JSON.stringify({ ...previous, llmAnalyzedAt: analyzedAt, whyItWorks: analysis.whyItWorks }),
    },
  });
}

function parseRawMetrics(raw: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(raw || "{}");
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function readReferenceScore(raw: string): number {
  const score = parseRawMetrics(raw).referenceScore;
  return typeof score === "number" && Number.isFinite(score) ? score : 0;
}

/** Analyzes the brand's best reference candidates that Claude has not read yet. */
export async function analyzeTopViralExamples(brandId: string): Promise<{ analyzed: number; skipped?: string }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { analyzed: 0, skipped: "ANTHROPIC_API_KEY is not set" };

  const pool = await prisma.viralExample.findMany({
    where: { brandId, source: { not: SHORTS_SOURCE }, NOT: { rawMetrics: { contains: "llmAnalyzedAt" } } },
    orderBy: { discoveredAt: "desc" },
    take: ANALYSIS_CANDIDATE_POOL,
    select: { id: true, content: true, rawMetrics: true },
  });
  const examples = pool
    .map((example) => ({ example, score: readReferenceScore(example.rawMetrics) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, ANALYSIS_BATCH_SIZE)
    .map(({ example }) => example);
  if (examples.length === 0) return { analyzed: 0 };

  const analyses = await requestAnalyses(new Anthropic({ apiKey, timeout: 60_000, maxRetries: 1 }), examples);
  const rawById = new Map(examples.map((example) => [example.id, example.rawMetrics]));
  const analyzedAt = new Date().toISOString();
  for (const analysis of analyses) {
    await saveAnalysis(analysis, rawById.get(analysis.id) ?? "{}", analyzedAt);
  }
  return { analyzed: analyses.length };
}
