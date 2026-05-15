export type ViralPatternDimension = "hook" | "topic" | "emotion" | "structure" | "cta";
export type ViralAdapterId = "owned_posts" | "threads_keyword" | "threads_profile" | "manual";

export interface ViralPatternSummary {
  dimension: ViralPatternDimension;
  value: string;
  count: number;
  avgViralScore: number;
  confidence: number;
  exampleIds: string[];
  recommendation: string;
}

export interface ViralMemory {
  version: 1;
  updatedAt: string;
  sampleSize: number;
  avgViralScore: number;
  sourceMix: Record<string, number>;
  topPatterns: ViralPatternSummary[];
  recommendations: string[];
}

export interface ManualViralExample {
  content: string;
  authorUsername?: string;
  permalink?: string;
  publishedAt?: string;
  views?: number;
  likes?: number;
  replies?: number;
  reposts?: number;
  quotes?: number;
  shares?: number;
}

export interface ViralSourceError {
  adapter: ViralAdapterId;
  source: string;
  message: string;
}

export const EMPTY_VIRAL_MEMORY: ViralMemory = {
  version: 1,
  updatedAt: "",
  sampleSize: 0,
  avgViralScore: 0,
  sourceMix: {},
  topPatterns: [],
  recommendations: [],
};

export function parseViralMemory(raw: string): ViralMemory {
  try {
    const parsed = JSON.parse(raw) as Partial<ViralMemory>;
    return {
      version: 1,
      updatedAt: parsed.updatedAt ?? "",
      sampleSize: parsed.sampleSize ?? 0,
      avgViralScore: parsed.avgViralScore ?? 0,
      sourceMix: parsed.sourceMix ?? {},
      topPatterns: normalizePatterns(parsed.topPatterns),
      recommendations: parsed.recommendations ?? [],
    };
  } catch {
    return EMPTY_VIRAL_MEMORY;
  }
}

function normalizePatterns(input: unknown): ViralPatternSummary[] {
  if (!Array.isArray(input)) return [];

  return input.flatMap((item): ViralPatternSummary[] => {
    if (typeof item !== "object" || item === null) return [];
    const pattern = item as Partial<ViralPatternSummary>;
    if (!isDimension(pattern.dimension) || typeof pattern.value !== "string") return [];

    return [{
      dimension: pattern.dimension,
      value: pattern.value,
      count: pattern.count ?? 0,
      avgViralScore: pattern.avgViralScore ?? 0,
      confidence: pattern.confidence ?? 0,
      exampleIds: Array.isArray(pattern.exampleIds)
        ? pattern.exampleIds.filter((id): id is string => typeof id === "string")
        : [],
      recommendation: pattern.recommendation ?? "",
    }];
  });
}

function isDimension(value: unknown): value is ViralPatternDimension {
  return value === "hook"
    || value === "topic"
    || value === "emotion"
    || value === "structure"
    || value === "cta";
}
