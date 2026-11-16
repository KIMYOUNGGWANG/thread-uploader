import { prisma } from "@/lib/prisma";
import { parseBrandConfig, serializeBrandConfigUpdate } from "@/types/brand";

const MAX_ATTEMPTS = 3;

/**
 * The top-level keys of `after` whose value differs from `before`, the config as the writer read it.
 * A key set to `undefined` stays in the result so the write removes it; keys missing from `after` are left alone.
 */
export function changedBrandConfigKeys(before: object, after: object): Record<string, unknown> {
  const baseline = before as Record<string, unknown>;
  const changed: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(after)) {
    if (JSON.stringify(value) !== JSON.stringify(baseline[key])) changed[key] = value;
  }
  return changed;
}

/**
 * Saves a brandConfig change without reverting what other writers saved since this one read the brand.
 * Writers used to merge their whole config into the raw string they read at the start of a request, so a settings
 * save, the learn cron or a health override that landed in between was overwritten. This applies only the keys the
 * writer actually changed (`readRaw` -> `after`) onto the config stored now, and only if it is still what was just
 * read; otherwise it re-reads and tries again.
 * `after` must come from `parseBrandConfig(readRaw)` (or a patch of a few keys), so unchanged keys compare equal.
 * Returns the brandConfig it stored, or undefined when nothing changed or the brand is gone.
 */
export async function patchBrandConfig(brandId: string, readRaw: string | null | undefined, after: object): Promise<string | undefined> {
  const patch = changedBrandConfigKeys(parseBrandConfig(readRaw || "{}"), after);
  if (Object.keys(patch).length === 0) return undefined;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const current = await prisma.brand.findUnique({ where: { id: brandId }, select: { brandConfig: true } });
    if (!current) return undefined;
    const brandConfig = serializeBrandConfigUpdate(current.brandConfig, patch);
    const { count } = await prisma.brand.updateMany({ where: { id: brandId, brandConfig: current.brandConfig }, data: { brandConfig } });
    if (count === 1) return brandConfig;
  }
  throw new Error(`brandConfig of ${brandId} changed concurrently; gave up after ${MAX_ATTEMPTS} attempts`);
}
