// Publish slots (UTC hours) pinned per brand on the server. Three schedulers call /api/cron/publish with their own
// ?slots= list (GitHub Actions, the Cloudflare worker, cron-job.org), and on 2026-11-04 the external two still sent
// the pre-10-28 KR list (KST 09/12/18/21/23). The daily cap of 3 was then spent by the KST 09/12 slots, the
// lowest-reach hours. A pinned brand ignores the caller's list, so changing a brand's slots is one edit here
// instead of three deploys. Unpinned brands keep using the caller's list.
export const BRAND_PUBLISH_SLOTS_UTC: Readonly<Record<string, readonly number[]>> = {
  // 2026-11-06 metrics since 10/28: posts landing around KST 00 had a 127-view median (n=7) vs ~60 at KST 09/12;
  // the KST 01 slot (UTC 16) had never published before 11/5 because of the quiet-hour guard, so it was unproven.
  // 2026-11-06 60-day audit: KST 09/11/12 were the weakest hours (50/90/54), KST 17 146; KST 11 moved to 17.
  cosmicpath: [8, 13, 15], // KST 17 / 22 / 00
  "cosmicpath-global": [0, 12], // US evening / US morning
};

// null means the run is not slot-gated (manual dispatch publishes immediately).
export function resolvePublishSlots(slug: string | null | undefined, requested: number[] | null): number[] | null {
  if (!requested) return null;
  const pinned = slug ? BRAND_PUBLISH_SLOTS_UTC[slug] : undefined;
  return pinned ? [...pinned] : requested;
}
