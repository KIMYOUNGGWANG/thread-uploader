import type { ViralMemory, ViralPatternDimension, ViralPatternSummary } from "@/types/viral";
import { EMPTY_VIRAL_MEMORY } from "@/types/viral";
import {
  hasSaveShareMechanic,
  hasSelfClassificationMechanic,
} from "@/lib/viral-intent-modes";

export interface ViralMetricsInput {
  views?: number | null;
  likes?: number | null;
  replies?: number | null;
  reposts?: number | null;
  quotes?: number | null;
  shares?: number | null;
  publishedAt?: Date | null;
  discoveredAt?: Date | null;
}

export interface ViralTextAnalysis {
  hookType: string;
  topic: string;
  emotionalDriver: string;
  structureType: string;
  ctaType: string;
  patternSummary: string;
  keyTakeaway: string;
}

export interface ViralExampleInput extends ViralMetricsInput {
  id: string;
  source: string;
  content: string;
  viralScore: number;
  hookType: string | null;
  topic: string | null;
  emotionalDriver: string | null;
  structureType: string | null;
  ctaType: string | null;
}

interface PatternBucket {
  dimension: ViralPatternDimension;
  value: string;
  examples: ViralExampleInput[];
}

export function calculateViralScore(metrics: ViralMetricsInput, content: string): number {
  const views = metrics.views ?? 0;
  const likes = metrics.likes ?? 0;
  const replies = metrics.replies ?? 0;
  const reposts = metrics.reposts ?? 0;
  const quotes = metrics.quotes ?? 0;
  const shares = metrics.shares ?? 0;
  const engagementScore = likes * 3 + replies * 8 + reposts * 13 + quotes * 14 + shares * 10;
  const rateScore = views > 0 ? Math.round((engagementScore / views) * 1000) : 0;
  const velocityScore = calculateVelocityScore(metrics);
  const structuralScore = calculateStructuralSignalScore(content);

  if (views === 0 && engagementScore === 0) {
    return structuralScore;
  }

  return Math.max(0, Math.round(engagementScore + rateScore * 2 + velocityScore + structuralScore));
}

export function calculateEngagementRate(metrics: ViralMetricsInput): number | null {
  const views = metrics.views ?? 0;
  if (views <= 0) return null;

  const engagements = (metrics.likes ?? 0)
    + (metrics.replies ?? 0)
    + (metrics.reposts ?? 0)
    + (metrics.quotes ?? 0)
    + (metrics.shares ?? 0);
  return Number((engagements / views).toFixed(4));
}

export function calculateVelocityScore(metrics: ViralMetricsInput): number {
  if (!metrics.publishedAt) return 0;
  const endTime = metrics.discoveredAt?.getTime() ?? Date.now();
  const ageHours = Math.max(1, (endTime - metrics.publishedAt.getTime()) / 36e5);
  const engagements = (metrics.likes ?? 0)
    + (metrics.replies ?? 0) * 2
    + (metrics.reposts ?? 0) * 3
    + (metrics.quotes ?? 0) * 3
    + (metrics.shares ?? 0) * 2;
  return Math.round((engagements / ageHours) * 10);
}

export function analyzeViralText(content: string, brandTopics: string[] = []): ViralTextAnalysis {
  const firstLine = getFirstLine(content);
  const hookType = detectHookType(firstLine, content);
  const emotionalDriver = detectEmotionalDriver(content);
  const structureType = detectStructureType(content);
  const ctaType = detectCtaType(content);
  const topic = detectTopic(content, brandTopics);

  return {
    hookType,
    topic,
    emotionalDriver,
    structureType,
    ctaType,
    patternSummary: `${hookType} + ${emotionalDriver} + ${structureType}`,
    keyTakeaway: buildTakeaway(hookType, emotionalDriver, structureType, ctaType),
  };
}

export function buildViralMemory(examples: ViralExampleInput[]): ViralMemory {
  if (examples.length === 0) return EMPTY_VIRAL_MEMORY;

  const avgViralScore = average(examples.map((example) => example.viralScore));
  const topPatterns = buildPatternSummaries(examples).slice(0, 12);

  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    sampleSize: examples.length,
    avgViralScore,
    sourceMix: buildSourceMix(examples),
    topPatterns,
    recommendations: buildRecommendations(topPatterns, examples.length),
  };
}

export function formatViralPromptContext(memory: ViralMemory): string {
  if (memory.sampleSize === 0 || memory.topPatterns.length === 0) {
    return "아직 외부 바이럴 레퍼런스 학습 데이터가 없습니다. 훅, 감정, 구조를 넓게 실험하세요.";
  }

  const patterns = memory.topPatterns.slice(0, 5).map((pattern) => (
    `- 바이럴 패턴: ${labelPattern(pattern)} (평균 ${pattern.avgViralScore}점, 신뢰도 ${pattern.confidence})`
  ));

  return [
    `최근 바이럴 레퍼런스 ${memory.sampleSize}개 학습 결과:`,
    ...patterns,
    "위 패턴의 구조만 가져오고, 문장과 주장은 브랜드에 맞게 새로 작성하세요.",
  ].join("\n");
}

function buildPatternSummaries(examples: ViralExampleInput[]): ViralPatternSummary[] {
  const buckets = [
    ...groupByDimension(examples, "hook", (example) => example.hookType),
    ...groupByDimension(examples, "topic", (example) => example.topic),
    ...groupByDimension(examples, "emotion", (example) => example.emotionalDriver),
    ...groupByDimension(examples, "structure", (example) => example.structureType),
    ...groupByDimension(examples, "cta", (example) => example.ctaType),
  ];

  return buckets
    .filter((bucket) => bucket.examples.length > 0)
    .map((bucket) => {
      const avgViralScore = average(bucket.examples.map((example) => example.viralScore));
      const confidence = calculateConfidence(bucket.examples.length, avgViralScore);
      return {
        dimension: bucket.dimension,
        value: bucket.value,
        count: bucket.examples.length,
        avgViralScore,
        confidence,
        exampleIds: bucket.examples.slice(0, 5).map((example) => example.id),
        recommendation: buildPatternRecommendation(bucket.dimension, bucket.value),
      };
    })
    .sort((a, b) => (
      (b.confidence + b.avgViralScore + patternPriority(b.value))
      - (a.confidence + a.avgViralScore + patternPriority(a.value))
    ));
}

function patternPriority(value: string): number {
  if (value === "자기분류" || value === "자기분류 댓글" || value === "자기분류 셀프체크") return 40;
  if (value === "저장형 도구" || value === "저장 유도") return 30;
  return 0;
}

function groupByDimension(
  examples: ViralExampleInput[],
  dimension: ViralPatternDimension,
  getValue: (example: ViralExampleInput) => string | null
): PatternBucket[] {
  const groups = new Map<string, ViralExampleInput[]>();
  for (const example of examples) {
    const value = getValue(example);
    if (!value?.trim()) continue;
    groups.set(value, [...(groups.get(value) ?? []), example]);
  }

  return Array.from(groups.entries()).map(([value, group]) => ({
    dimension,
    value,
    examples: group,
  }));
}

function calculateStructuralSignalScore(content: string): number {
  let score = 10;
  const firstLine = getFirstLine(content);
  if (hasSelfClassificationMechanic(content)) score += 14;
  if (hasSaveShareMechanic(content)) score += 10;
  if (firstLine.includes("?")) score += 12;
  if (/^\s*\d+[.)]/m.test(content)) score += 10;
  if (/(사실|솔직히|아무도|근데|반대로|문제는)/.test(firstLine)) score += 10;
  if (/(댓글|저장|공유|링크|첫 댓글)/.test(content)) score += 8;
  if (content.length >= 80 && content.length <= 450) score += 8;
  return score;
}

function detectHookType(firstLine: string, content: string): string {
  if (/\?/.test(firstLine)) return "질문형 훅";
  if (/(사실|근데|반대로|오히려|착각)/.test(firstLine)) return "반전형 훅";
  if (/(최악|거짓말|하지마|문제는|망하는)/.test(firstLine)) return "논쟁형 훅";
  if (/(솔직히|고백|나만|내가)/.test(firstLine)) return "고백형 훅";
  if (/^\s*\d+[.)]/m.test(content)) return "체크리스트형 훅";
  if (/\d+/.test(firstLine)) return "증거형 훅";
  return "공감형 훅";
}

function detectEmotionalDriver(content: string): string {
  if (/(화나|짜증|억울|최악|거짓말)/.test(content)) return "분노";
  if (/(무서|불안|망하|위험|놓치)/.test(content)) return "불안";
  if (/(사실|진짜|비밀|아무도|몰랐)/.test(content)) return "호기심";
  if (/(나만|우리|공감|알지|있잖아)/.test(content)) return "소속감";
  if (/(괜찮|살아|해결|바뀌|가능)/.test(content)) return "안도감";
  if (/(성공|돈|매출|성장|기회)/.test(content)) return "욕망";
  return "공감";
}

function detectStructureType(content: string): string {
  const lines = content.split("\n").filter((line) => line.trim());
  if (hasSelfClassificationMechanic(content)) return "자기분류";
  if (hasSaveShareMechanic(content) && /^\s*\d+[.)]/m.test(content)) return "저장형 도구";
  if (/^\s*\d+[.)]/m.test(content)) return "리스트";
  if (/(전에는|예전엔|지금은|바뀐)/.test(content)) return "비포애프터";
  if (/(근데|하지만|문제는|반대로)/.test(content)) return "반전";
  if (lines.length <= 2 && content.length < 160) return "짧은 선언";
  if (/(내가|어제|오늘|처음|겪)/.test(content)) return "스토리";
  return "의견 전개";
}

function detectCtaType(content: string): string {
  if (hasSelfClassificationMechanic(content)) return "자기분류 셀프체크";
  if (/(첫 댓글|링크|프로필)/.test(content)) return "링크 유도";
  if (/댓글/.test(content)) return "댓글 부담";
  if (/저장/.test(content)) return "저장 유도";
  if (/(공유|보내줘)/.test(content)) return "공유 유도";
  return "무CTA";
}

function detectTopic(content: string, brandTopics: string[]): string {
  const matchedTopic = brandTopics.find((topic) => topic && content.includes(topic));
  if (matchedTopic) return matchedTopic;

  const keyword = content
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .find((word) => word.length >= 3 && !COMMON_WORDS.has(word));
  return keyword ?? "일반";
}

function buildTakeaway(
  hookType: string,
  emotionalDriver: string,
  structureType: string,
  ctaType: string
): string {
  return `${hookType}으로 멈춰 세우고, ${emotionalDriver} 감정을 건드린 뒤, ${structureType} 구조로 끝까지 읽게 만든다. CTA는 ${ctaType} 방식.`;
}

function buildPatternRecommendation(dimension: ViralPatternDimension, value: string): string {
  if (value === "자기분류" || value === "자기분류 댓글" || value === "자기분류 셀프체크") {
    return "다음 배치에서 A/B/C 또는 4방향 자기분류 구조를 새 고민 주제로 변주해 테스트하세요.";
  }
  if (value === "저장형 도구" || value === "저장 유도") {
    return "다음 배치에서 저장 가능한 체크리스트/판정표 구조를 새 고민 주제로 변주해 테스트하세요.";
  }
  const labels: Record<ViralPatternDimension, string> = {
    hook: "첫 문장",
    topic: "주제",
    emotion: "감정",
    structure: "전개 구조",
    cta: "행동 유도",
  };
  return `다음 배치에서 ${labels[dimension]} '${value}' 패턴을 새 주장으로 변주해 테스트하세요.`;
}

function buildRecommendations(patterns: ViralPatternSummary[], sampleSize: number): string[] {
  const recommendations = [];
  if (sampleSize < 10) {
    recommendations.push("바이럴 레퍼런스 표본이 작습니다. 키워드/핸들 소스를 늘려 먼저 20개 이상 확보하세요.");
  }
  if (patterns[0]) recommendations.push(patterns[0].recommendation);
  if (patterns[1]) recommendations.push(patterns[1].recommendation);
  return recommendations;
}

function buildSourceMix(examples: ViralExampleInput[]): Record<string, number> {
  return examples.reduce<Record<string, number>>((mix, example) => {
    mix[example.source] = (mix[example.source] ?? 0) + 1;
    return mix;
  }, {});
}

function calculateConfidence(count: number, avgViralScore: number): number {
  return Math.min(100, Math.round(count * 14 + avgViralScore / 25));
}

function labelPattern(pattern: ViralPatternSummary): string {
  const labels: Record<ViralPatternDimension, string> = {
    hook: "훅",
    topic: "주제",
    emotion: "감정",
    structure: "구조",
    cta: "CTA",
  };
  return `${labels[pattern.dimension]} '${pattern.value}'`;
}

function getFirstLine(content: string): string {
  return content.split("\n").find((line) => line.trim().length > 0)?.trim() ?? "";
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

const COMMON_WORDS = new Set([
  "그리고",
  "하지만",
  "그래서",
  "이렇게",
  "저렇게",
  "진짜",
  "사실",
  "너무",
  "그냥",
  "오늘",
]);
