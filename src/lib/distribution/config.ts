import { isRecord } from "@/types/config-normalizers";

export type VideoChannel = "youtube" | "instagram" | "tiktok";
export const VIDEO_CHANNELS: readonly VideoChannel[] = ["youtube", "instagram", "tiktok"];

export interface DistributionConfig {
  /** Hours between a finished video/card set and its upload; the cancel window. */
  cancelWindowHours: number;
  video: { channels: VideoChannel[] };
  cardNews: { enabled: boolean; dailyCap: number; minViews: number; lookbackDays: number };
  x: { enabled: boolean; dailyCap: number };
}

export const DEFAULT_DISTRIBUTION_CONFIG: DistributionConfig = {
  cancelWindowHours: 3,
  video: { channels: [...VIDEO_CHANNELS] },
  cardNews: { enabled: true, dailyCap: 1, minViews: 0, lookbackDays: 7 },
  x: { enabled: true, dailyCap: 3 },
};

const intIn = (value: unknown, min: number, max: number, fallback: number): number =>
  typeof value === "number" && Number.isInteger(value) && value >= min && value <= max ? value : fallback;
const bool = (value: unknown, fallback: boolean): boolean => (typeof value === "boolean" ? value : fallback);

export function normalizeDistributionConfig(input: unknown): DistributionConfig {
  const raw = isRecord(input) ? input : {};
  const d = DEFAULT_DISTRIBUTION_CONFIG;
  const video = isRecord(raw.video) ? raw.video : {};
  const cardNews = isRecord(raw.cardNews) ? raw.cardNews : {};
  const x = isRecord(raw.x) ? raw.x : {};
  const channels = Array.isArray(video.channels)
    ? VIDEO_CHANNELS.filter((channel) => (video.channels as unknown[]).includes(channel))
    : [...d.video.channels];
  return {
    cancelWindowHours: intIn(raw.cancelWindowHours, 0, 48, d.cancelWindowHours),
    video: { channels },
    cardNews: {
      enabled: bool(cardNews.enabled, d.cardNews.enabled),
      dailyCap: intIn(cardNews.dailyCap, 1, 5, d.cardNews.dailyCap),
      minViews: intIn(cardNews.minViews, 0, 10_000_000, d.cardNews.minViews),
      lookbackDays: intIn(cardNews.lookbackDays, 1, 30, d.cardNews.lookbackDays),
    },
    x: { enabled: bool(x.enabled, d.x.enabled), dailyCap: intIn(x.dailyCap, 1, 15, d.x.dailyCap) },
  };
}

/** Reads `distribution` from a stored brandConfig JSON string (kept outside BrandConfig's parser on purpose). */
export function parseDistributionConfig(rawBrandConfig: string | null | undefined): DistributionConfig {
  try {
    const parsed: unknown = JSON.parse(rawBrandConfig || "{}");
    return normalizeDistributionConfig(isRecord(parsed) ? parsed.distribution : undefined);
  } catch {
    return normalizeDistributionConfig(undefined);
  }
}

export function autoPublishAtFor(rawBrandConfig: string | null | undefined, completedAt: Date): Date {
  const hours = parseDistributionConfig(rawBrandConfig).cancelWindowHours;
  return new Date(completedAt.getTime() + hours * 60 * 60 * 1000);
}
