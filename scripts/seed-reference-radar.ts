process.loadEnvFile(".env");

import { prisma } from "../src/lib/prisma";
import { lookupThreadsUsername, planRadarSeed } from "../src/lib/reference-radar-seed";
import { parseBrandConfig, serializeBrandConfigUpdate } from "../src/types/brand";

// One-off seed: fills cosmicpath's empty viralDiscovery.keywords / ownHandle. Never overwrites existing values.
// Usage: npx tsx scripts/seed-reference-radar.ts [--dry-run] [--own-handle=<name>]
// Without a local .env, run the "Seed Reference Radar" GitHub workflow (same logic, /api/cron/seed-reference-radar).

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  // Typos like --dryrun must not fall through to a real DB write.
  const unknown = args.filter((arg) => arg !== "--dry-run" && !arg.startsWith("--own-handle="));
  if (unknown.length > 0) throw new Error(`알 수 없는 인자: ${unknown.join(" ")}`);
  const dryRun = args.includes("--dry-run");
  const ownHandleArg = args.find((arg) => arg.startsWith("--own-handle="))?.slice("--own-handle=".length).trim().replace(/^@+/, "");

  const brand = await prisma.brand.findUnique({
    where: { slug: "cosmicpath" },
    select: { id: true, brandConfig: true, threadsUserId: true },
  });
  if (!brand) throw new Error("Brand cosmicpath not found");

  const current = parseBrandConfig(brand.brandConfig).viralDiscovery;
  const ownHandle = current.ownHandle ? undefined : ownHandleArg || (await lookupThreadsUsername(brand.id, brand.threadsUserId));
  const changes = planRadarSeed(current, ownHandle);

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
  if (dryRun) return console.log(`--dry-run: brandConfig는 쓰지 않음 (바뀔 필드: ${changed.join(", ")})`);

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
