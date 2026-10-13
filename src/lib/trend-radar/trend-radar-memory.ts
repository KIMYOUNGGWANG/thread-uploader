import type { TransposedViralCandidate } from "./transposition-engine";

/** Daily trend-radar output stored on brandConfig.trendRadar and injected into generation. */

export interface TrendRadarItem {
  domain: string;
  hookHeadline: string;
  openingNarrative: string;
  brandConcept: string;
  choices: string[];
}

export interface TrendRadarMemory {
  harvestedAt: string;
  items: TrendRadarItem[];
}

const MAX_ITEMS = 6;
const STALE_AFTER_MS = 4 * 24 * 60 * 60 * 1000; // harvest covers 72h; skip if the daily job stopped

export function toTrendRadarMemory(candidates: TransposedViralCandidate[], harvestedAt: Date): TrendRadarMemory {
  return {
    harvestedAt: harvestedAt.toISOString(),
    items: candidates.slice(0, MAX_ITEMS).map((candidate) => ({
      domain: candidate.targetDomain,
      hookHeadline: candidate.hookHeadline,
      openingNarrative: candidate.openingNarrative,
      brandConcept: candidate.domainMapping.brandEquivalentConcept,
      choices: [...candidate.choiceMatrix],
    })),
  };
}

export function readTrendRadar(rawBrandConfig: string | null | undefined): TrendRadarMemory | null {
  try {
    const parsed: unknown = JSON.parse(rawBrandConfig || "{}");
    if (typeof parsed !== "object" || parsed === null) return null;
    const radar = (parsed as Record<string, unknown>).trendRadar;
    if (typeof radar !== "object" || radar === null) return null;
    const { harvestedAt, items } = radar as Record<string, unknown>;
    if (typeof harvestedAt !== "string" || !Array.isArray(items)) return null;
    return { harvestedAt, items: items.filter(isTrendRadarItem) };
  } catch {
    return null;
  }
}

function isTrendRadarItem(item: unknown): item is TrendRadarItem {
  if (typeof item !== "object" || item === null) return false;
  const record = item as Record<string, unknown>;
  const textFields = ["domain", "hookHeadline", "openingNarrative", "brandConcept"];
  return textFields.every((field) => typeof record[field] === "string")
    && Array.isArray(record.choices) && record.choices.every((choice) => typeof choice === "string");
}

export function formatTrendRadarContext(memory: TrendRadarMemory | null, now: Date = new Date()): string {
  if (!memory || memory.items.length === 0) return "";
  const harvestedAtMs = Date.parse(memory.harvestedAt);
  if (!Number.isFinite(harvestedAtMs) || now.getTime() - harvestedAtMs > STALE_AFTER_MS) return "";
  const lines = memory.items.map((item) =>
    `- [${item.domain}] 훅: "${item.hookHeadline}" / 브랜드 개념: ${item.brandConcept} / 선택지: ${item.choices.join(" | ")}`
  );
  return [
    `[최근 72시간 트렌드 레이더] (수집 ${memory.harvestedAt.slice(0, 10)})`,
    ...lines,
    "주제와 맞는 트렌드가 있으면 시의성 있는 소재로 쓰되, 실제 사건·회사·인물 고유명사는 쓰지 마세요.",
  ].join("\n");
}
