const fs = require("node:fs/promises");
const path = require("node:path");
const { PrismaClient } = require("@prisma/client");
const { buildCosmicPathViralResetConfig } = require("./cosmicpath-viral-reset-config");

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const prisma = new PrismaClient();

  try {
    const brand = await prisma.brand.findFirst({ where: { slug: options.brandSlug } });
    if (!brand) throw new Error(`Brand not found: ${options.brandSlug}`);

    const currentConfig = parseConfig(brand.brandConfig);
    const nextConfig = buildCosmicPathViralResetConfig(currentConfig);
    const backupPath = await writeBackup(brand, currentConfig, nextConfig, options.apply);

    console.log(`Backup: ${backupPath}`);
    console.log(`Mode: ${options.apply ? "APPLY" : "DRY RUN"}`);
    console.log("Campaign: cosmicpath_viral_reset_v1 | daily=3 | links=every 3rd | mix=4:4:4:3");

    if (!options.apply) {
      console.log("No database changes made. Re-run with --apply only after review.");
      return;
    }

    await prisma.brand.update({
      where: { id: brand.id },
      data: { brandConfig: JSON.stringify(nextConfig) },
    });
    console.log(`Applied to ${brand.slug}.`);
  } finally {
    await prisma.$disconnect();
  }
}

function parseArgs(args) {
  let brandSlug = "cosmicpath";
  let apply = false;
  for (const arg of args) {
    if (arg === "--apply") apply = true;
    else if (arg.startsWith("--brand-slug=")) brandSlug = arg.slice("--brand-slug=".length).trim();
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!brandSlug) throw new Error("--brand-slug requires a value");
  return { brandSlug, apply };
}

function parseConfig(raw) {
  try {
    const parsed = JSON.parse(raw || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    throw new Error("Stored brandConfig is not valid JSON");
  }
}

async function writeBackup(brand, currentConfig, nextConfig, apply) {
  const resultsDirectory = path.join(process.cwd(), ".agents", "results");
  await fs.mkdir(resultsDirectory, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = path.join(resultsDirectory, `cosmicpath-viral-reset-${timestamp}.json`);
  await fs.writeFile(backupPath, JSON.stringify({
    brand: { id: brand.id, slug: brand.slug },
    mode: apply ? "apply" : "dry-run",
    currentConfig,
    nextConfig,
  }, null, 2));
  return backupPath;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
