export type BaselineStatus = "measured" | "insufficient" | "skipped";

export interface StoredBaseline {
  baselineStatus: BaselineStatus;
  channelMedianViews: number | null;
  baselineSampleSize: number;
  baselineComputedAt: string | null; // ISO, null when skipped
}

export const BASELINE_KEYS: ReadonlyArray<keyof StoredBaseline> = [
  "baselineStatus",
  "channelMedianViews",
  "baselineSampleSize",
  "baselineComputedAt",
];

export interface BaselineVideo {
  id: string;
  publishedAt: Date;
  durationSec: number | null;
  views: number;
}

const DAY_MS = 86_400_000;
const MIN_AGE_MS = 3 * DAY_MS; // views of fresh uploads are still growing, so they skew the "usual" level
const SAMPLE = 12; // recent enough to reflect the channel today, large enough to damp one-off hits
const MIN_SAMPLE = 5; // a median of fewer videos is too noisy to trust
const TTL_MS = 7 * DAY_MS; // channel level moves slowly; re-measuring daily wastes API quota
const MAX_CHANNELS = 40; // caps YouTube API calls per run
export const BASELINE_UPLOADS = 50; // uploads fetched per channel (Shorts + long-form mixed); enough to find SAMPLE shorts

const STATUSES: ReadonlyArray<unknown> = ["measured", "insufficient", "skipped"];

function median(sorted: number[]): number {
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// No "exclude self" step: targets are <48h old and the baseline only takes >=3d old videos, so they never overlap.
export function computeChannelBaseline(
  videos: BaselineVideo[],
  opts: { now: Date; maxDurationSec: number },
): { medianViews: number | null; sampleSize: number } {
  const cutoff = opts.now.getTime() - MIN_AGE_MS;
  const sample = videos
    .filter((x) => x.publishedAt.getTime() <= cutoff && x.durationSec !== null && x.durationSec > 0 && x.durationSec <= opts.maxDurationSec)
    .sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime())
    .slice(0, SAMPLE);
  if (sample.length < MIN_SAMPLE) return { medianViews: null, sampleSize: sample.length };
  const m = median(sample.map((x) => x.views).sort((a, b) => a - b));
  return { medianViews: m > 0 ? m : null, sampleSize: sample.length };
}

export function computeOutlier(views: number, medianViews: number | null): { outlierRatio: number | null; viralScore: number } {
  if (medianViews === null || medianViews <= 0) return { outlierRatio: null, viralScore: 0 };
  const outlierRatio = Math.round((views / medianViews) * 100) / 100;
  return { outlierRatio, viralScore: Math.round(outlierRatio * 100) };
}

export function readStoredBaseline(raw: Record<string, unknown>): StoredBaseline | null {
  const { baselineStatus: status, channelMedianViews: median, baselineSampleSize: size, baselineComputedAt: at } = raw;
  if (!STATUSES.includes(status)) return null;
  if (median !== null && typeof median !== "number") return null;
  if (typeof size !== "number") return null;
  if (at !== null && typeof at !== "string") return null;
  return { baselineStatus: status as BaselineStatus, channelMedianViews: median, baselineSampleSize: size, baselineComputedAt: at };
}

function isFresh(b: StoredBaseline | null, now: Date): b is StoredBaseline {
  if (!b || b.baselineStatus === "skipped" || !b.baselineComputedAt) return false;
  const age = now.getTime() - new Date(b.baselineComputedAt).getTime();
  return age <= TTL_MS; // NaN (bad date) compares false -> treated as stale
}

export function planBaselineWork(
  channels: Array<{ channelId: string; baselines: Array<StoredBaseline | null> }>,
  now: Date,
): { reuse: Map<string, StoredBaseline>; measure: string[]; skip: string[] } {
  const reuse = new Map<string, StoredBaseline>();
  const measure: string[] = [];
  const skip: string[] = [];
  for (const { channelId, baselines } of channels) {
    const fresh = baselines.filter((b): b is StoredBaseline => isFresh(b, now));
    if (fresh.length > 0) {
      reuse.set(channelId, fresh.reduce((a, b) => (b.baselineComputedAt! > a.baselineComputedAt! ? b : a)));
    } else if (measure.length < MAX_CHANNELS) measure.push(channelId);
    else skip.push(channelId);
  }
  return { reuse, measure, skip };
}
