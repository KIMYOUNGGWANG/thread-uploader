import { getFreshBrandCredentials } from "@/lib/threads-api";
import type { ViralDiscoveryConfig } from "@/types/brand";

// The reference radar (viral cron + ref_replay) skips a brand whose viralDiscovery.keywords is empty. cosmicpath's
// list was never seeded: every viral run from 2026-10-28 to 11-04 returned "no_keywords", so nothing was ever
// learned from other accounts. These are the saju searches the seed script has always used.
export const COSMICPATH_RADAR_KEYWORDS: readonly string[] = ["사주", "궁합", "대운", "일주", "신년운세", "사주 궁합", "재물운", "이직 사주"];

export interface RadarSeedChanges {
  keywords?: string[];
  ownHandle?: string;
}

// Fills only empty fields; an operator's own keywords or handle are never overwritten.
export function planRadarSeed(current: ViralDiscoveryConfig, ownHandle: string | undefined): RadarSeedChanges {
  const changes: RadarSeedChanges = {};
  if (current.keywords.length === 0) changes.keywords = [...COSMICPATH_RADAR_KEYWORDS];
  if (!current.ownHandle && ownHandle) changes.ownHandle = ownHandle;
  return changes;
}

export async function lookupThreadsUsername(brandId: string, threadsUserId: string | null): Promise<string | undefined> {
  try {
    if (!threadsUserId) throw new Error("threadsUserId is not set");
    const { accessToken } = await getFreshBrandCredentials(brandId);
    const url = `https://graph.threads.net/v1.0/${threadsUserId}?fields=username&access_token=${encodeURIComponent(accessToken)}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Threads API ${response.status}`);
    const data: unknown = await response.json();
    const username = typeof data === "object" && data !== null && "username" in data ? data.username : undefined;
    if (typeof username !== "string" || !username) throw new Error("username missing in response");
    return username;
  } catch (error) {
    console.error(`ownHandle lookup failed: ${error instanceof Error ? error.message : String(error)}`);
    return undefined;
  }
}
