// Research-driven, card-first brands (wellness media) opt in with brandConfig.wellness.
// A brand without that key is untouched by everything under src/lib/wellness.

export interface WellnessConfig {
  feeds: string[];
  dailyDrafts: number;
  minScore: number;
  maxArticleAgeDays: number;
}

const clampInt = (value: unknown, fallback: number, min: number, max: number): number =>
  typeof value === "number" && Number.isFinite(value) ? Math.min(max, Math.max(min, Math.round(value))) : fallback;

export function readWellnessConfig(rawBrandConfig: string | null | undefined): WellnessConfig | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBrandConfig || "{}");
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const wellness = (parsed as Record<string, unknown>).wellness;
  if (typeof wellness !== "object" || wellness === null) return null;
  const raw = wellness as Record<string, unknown>;
  const feeds = Array.isArray(raw.feeds)
    ? raw.feeds.filter((feed): feed is string => typeof feed === "string" && /^https?:\/\//.test(feed.trim())).map((feed) => feed.trim())
    : [];
  return {
    feeds,
    dailyDrafts: clampInt(raw.dailyDrafts, 2, 1, 5),
    minScore: clampInt(raw.minScore, 50, 0, 100),
    maxArticleAgeDays: clampInt(raw.maxArticleAgeDays, 3, 1, 14),
  };
}

export function isCardFirstBrand(rawBrandConfig: string | null | undefined): boolean {
  return readWellnessConfig(rawBrandConfig) !== null;
}
