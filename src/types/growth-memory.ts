import { isRecord } from "@/types/config-normalizers";

export interface GrowthPattern {
  dimension: "formula" | "hook" | "topic" | "target" | "cta";
  value: string;
  count: number;
  avgScore: number;
  avgViews: number;
  avgLikes: number;
  avgReplies: number;
  avgReposts: number;
}

export interface GrowthMemory {
  version: 1;
  updatedAt: string;
  sampleSize: number;
  avgScore: number;
  winners: GrowthPattern[];
  weakSignals: GrowthPattern[];
  recommendations: string[];
}

export const EMPTY_GROWTH_MEMORY: GrowthMemory = {
  version: 1,
  updatedAt: "",
  sampleSize: 0,
  avgScore: 0,
  winners: [],
  weakSignals: [],
  recommendations: [],
};

export function parseGrowthMemory(raw: string): GrowthMemory {
  try {
    const parsedJson: unknown = JSON.parse(raw);
    const parsed = isRecord(parsedJson) ? parsedJson : {};
    return {
      version: 1,
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : "",
      sampleSize: normalizeNumber(parsed.sampleSize),
      avgScore: normalizeNumber(parsed.avgScore),
      winners: normalizeGrowthPatterns(parsed.winners),
      weakSignals: normalizeGrowthPatterns(parsed.weakSignals),
      recommendations: normalizeRecommendations(parsed.recommendations),
    };
  } catch {
    return EMPTY_GROWTH_MEMORY;
  }
}

function normalizeGrowthPatterns(input: unknown): GrowthPattern[] {
  if (!Array.isArray(input)) return [];
  return input.filter(isRecord).flatMap((pattern) => {
    const dimension = normalizeGrowthDimension(pattern.dimension);
    if (!dimension || typeof pattern.value !== "string") return [];
    return [{
      dimension,
      value: pattern.value,
      count: normalizeNumber(pattern.count),
      avgScore: normalizeNumber(pattern.avgScore),
      avgViews: normalizeNumber(pattern.avgViews),
      avgLikes: normalizeNumber(pattern.avgLikes),
      avgReplies: normalizeNumber(pattern.avgReplies),
      avgReposts: normalizeNumber(pattern.avgReposts),
    }];
  });
}

function normalizeGrowthDimension(input: unknown): GrowthPattern["dimension"] | null {
  return input === "formula" || input === "hook" || input === "topic" || input === "target" || input === "cta"
    ? input
    : null;
}

function normalizeRecommendations(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input.filter((value): value is string => typeof value === "string");
}

function normalizeNumber(input: unknown): number {
  return typeof input === "number" && Number.isFinite(input) ? input : 0;
}
