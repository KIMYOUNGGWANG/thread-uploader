process.loadEnvFile(".env");

import { prisma } from "../src/lib/prisma";
import { getFreshBrandCredentials } from "../src/lib/threads-api";
import { parseBrandConfig, serializeBrandConfigUpdate } from "../src/types/brand";

// One-off seed: fills cosmicpath's empty viralDiscovery.keywords / ownHandle. Never overwrites existing values.
// Usage: npx tsx scripts/seed-reference-radar.ts [--dry-run] [--own-handle=<name>]
const KEYWORDS = ["사주", "궁합", "대운", "일주", "신년운세", "사주 궁합", "재물운", "이직 사주"];

async function lookupUsername(brandId: string, threadsUserId: string | null): Promise<string | undefined> {
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

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const ownHandleArg = args.find((arg) => arg.startsWith("--own-handle="))?.slice("--own-handle=".length).trim();

  const brand = await prisma.brand.findUnique({
    where: { slug: "cosmicpath" },
    select: { id: true, brandConfig: true, threadsUserId: true },
  });
  if (!brand) throw new Error("Brand cosmicpath not found");

  const current = parseBrandConfig(brand.brandConfig).viralDiscovery;
  const changes: { keywords?: string[]; ownHandle?: string } = {};

  if (current.keywords.length === 0) changes.keywords = KEYWORDS;
  if (!current.ownHandle) {
    const ownHandle = ownHandleArg || (await lookupUsername(brand.id, brand.threadsUserId));
    if (ownHandle) changes.ownHandle = ownHandle;
  }

  console.log(changes.keywords ? `keywords: 설정 → [${changes.keywords.join(", ")}]` : `keywords: 그대로 (${current.keywords.length}개)`);
  console.log(
    changes.ownHandle
      ? `ownHandle: 설정 → ${changes.ownHandle}`
      : current.ownHandle
        ? `ownHandle: 그대로 (${current.ownHandle})`
        : "ownHandle: 비어 있음 (조회 실패, --own-handle=<값>으로 다시 실행)",
  );
  console.log(`excludedHandles: 그대로 (${current.excludedHandles.length}개)`);

  const changed = Object.keys(changes);
  if (changed.length === 0) return console.log("변경할 값 없음");
  if (dryRun) return console.log(`--dry-run: 쓰지 않음 (바뀔 필드: ${changed.join(", ")})`);

  await prisma.brand.update({
    where: { id: brand.id },
    data: { brandConfig: serializeBrandConfigUpdate(brand.brandConfig, { viralDiscovery: { ...current, ...changes } }) },
  });
  console.log(`저장 완료 (바뀐 필드: ${changed.join(", ")})`);
}

main()
  .then(() => 0)
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    return 1;
  })
  .then(async (code) => {
    await prisma.$disconnect();
    process.exit(code);
  });
