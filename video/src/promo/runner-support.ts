// runner-support.ts — pure helpers for scripts/render-promo-job.mjs (kept here so they are testable).

const SECRET_KEYS = new Set(["CRON_SECRET", "BLOB_READ_WRITE_TOKEN", "COSMICPATH_READ_TOKEN"]);

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

// already_queued is a normal re-run outcome; a missing brand means nothing was queued for it — fail loudly.
export function queueFailures(results: unknown): string[] {
  if (!Array.isArray(results)) return ["unexpected /api/cron/promo-posts response"];
  return results
    .filter((result): result is Record<string, unknown> => isRecord(result) && result.skipped === "brand_not_found")
    .map((result) => `${String(result.brandSlug)}: brand_not_found`);
}

// Engines, Remotion and ffmpeg never need the app/storage secrets; keep them out of child processes.
export function scrubbedEnv(
  env: Record<string, string | undefined>,
  overrides: Record<string, string> = {},
): Record<string, string> {
  const kept = Object.entries(env).filter((entry): entry is [string, string] => entry[1] !== undefined && !SECRET_KEYS.has(entry[0]));
  return { ...Object.fromEntries(kept), ...overrides };
}
