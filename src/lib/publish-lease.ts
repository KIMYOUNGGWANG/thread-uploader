import { prisma } from "@/lib/prisma";
import { isRecord } from "@/types/config-normalizers";
import { serializeBrandConfigUpdate } from "@/types/brand";

// Longer than the publish route's maxDuration (300s), so a run that dies mid-publish frees the lease by itself.
export const PUBLISH_LEASE_MS = 6 * 60 * 1000;

// Kept in brandConfig as a key BrandConfig does not model: serializeBrandConfigUpdate preserves unknown keys, and the
// route's end-of-run brandConfig write is built from the snapshot taken before the lease, so it clears the lease.
const LEASE_KEY = "publishLeaseUntil";

function parseConfigObject(raw: string | null | undefined): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(raw || "{}");
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function readPublishLeaseUntil(rawBrandConfig: string | null | undefined): Date | null {
  const until = parseConfigObject(rawBrandConfig)?.[LEASE_KEY];
  const date = typeof until === "string" ? new Date(until) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
}

/**
 * One publish run per brand at a time. GitHub Actions, the Cloudflare worker and cron-job.org all call /api/cron/publish,
 * and slot, cooldown and quota only count PUBLISHED rows, which appear after the 30-300s publish. A second run starting
 * in that window would pick the next PENDING post and publish it into the same slot.
 *
 * Returns true when this run now owns the lease, false while another run's unexpired lease is held.
 */
export async function acquirePublishLease(brandId: string, now: Date = new Date()): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    // Same per-brand advisory lock as instagram-reels-sync: the check and the write below cannot interleave.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${brandId}::text))`;
    const brand = await tx.brand.findUnique({ where: { id: brandId }, select: { brandConfig: true } });
    if (!brand) return false;

    const heldUntil = readPublishLeaseUntil(brand.brandConfig);
    if (heldUntil && heldUntil.getTime() > now.getTime()) return false;

    // An unparseable config has nothing safe to merge the lease into; writing it would replace the stored text.
    if (!parseConfigObject(brand.brandConfig)) return true;

    await tx.brand.update({
      where: { id: brandId },
      data: {
        brandConfig: serializeBrandConfigUpdate(brand.brandConfig, {
          [LEASE_KEY]: new Date(now.getTime() + PUBLISH_LEASE_MS).toISOString(),
        }),
      },
    });
    return true;
  });
}
