// Publish slots (UTC hours) pinned per brand on the server. Three schedulers call /api/cron/publish with their own
// ?slots= list (GitHub Actions, the Cloudflare worker, cron-job.org), and on 2026-11-04 the external two still sent
// the pre-10-28 KR list (KST 09/12/18/21/23). The daily cap of 3 was then spent by the KST 09/12 slots, the
// lowest-reach hours. A pinned brand ignores the caller's list, so changing a brand's slots is one edit here
// instead of three deploys. Unpinned brands keep using the caller's list.
export const BRAND_PUBLISH_SLOTS_UTC: Readonly<Record<string, readonly number[]>> = {
  cosmicpath: [2, 13, 16], // KST 11 / 22 / 01
  "cosmicpath-global": [0, 12], // US evening / US morning
};

// null means the run is not slot-gated (manual dispatch publishes immediately).
export function resolvePublishSlots(slug: string | null | undefined, requested: number[] | null): number[] | null {
  if (!requested) return null;
  const pinned = slug ? BRAND_PUBLISH_SLOTS_UTC[slug] : undefined;
  return pinned ? [...pinned] : requested;
}
