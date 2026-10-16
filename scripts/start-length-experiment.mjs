// Starts the pre-registered cosmicpath length experiment (docs/experiments/2026-10-16-post-length.md)
// by writing brandConfig.lengthExperiment. Idempotent: an existing experiment is printed, never overwritten.
// Usage: node --env-file=.env scripts/start-length-experiment.mjs [--dry-run]
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";

const SLUG = "cosmicpath";
const dryRun = process.argv.includes("--dry-run");
const prisma = new PrismaClient();

async function main() {
  const preRegistered = JSON.parse(readFileSync(new URL("./length-experiment-sequence.json", import.meta.url), "utf8"));
  const brand = await prisma.brand.findUnique({ where: { slug: SLUG }, select: { id: true, brandConfig: true } });
  if (!brand) throw new Error(`brand ${SLUG} not found`);

  // Raw JSON merge so keys the app's parser does not model survive the write.
  const stored = JSON.parse(brand.brandConfig || "{}");
  if (stored.lengthExperiment) {
    console.log("already started, leaving it unchanged:", JSON.stringify(stored.lengthExperiment));
    return;
  }
  const lengthExperiment = { startAt: new Date().toISOString(), ...preRegistered };
  if (dryRun) {
    console.log("dry run, would write:", JSON.stringify(lengthExperiment));
    return;
  }
  await prisma.brand.update({ where: { id: brand.id }, data: { brandConfig: JSON.stringify({ ...stored, lengthExperiment }) } });
  console.log(`started: ${lengthExperiment.startAt} — record this exact ISO as 시작 시각(startAt) in docs/experiments/2026-10-16-post-length.md and pass it as --from when judging`);
}

main()
  .catch((error) => { console.error(error); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
