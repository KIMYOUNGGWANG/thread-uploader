/**
 * scripts/brand-generate.mjs
 * Universal multi-brand batch content generation CLI tool.
 *
 * Usage:
 *   npx tsx scripts/brand-generate.mjs --brand cosmicpath --count 5 --dry-run
 *   npx tsx scripts/brand-generate.mjs --brand cosmicpath-global --count 5
 *   npx tsx scripts/brand-generate.mjs --brand catchdex --count 5
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import { getDomainPreset } from "../src/lib/domain-registry.ts";
import { selectFormulaWithQuota } from "../src/lib/quota-bandit-router.ts";
import { buildTrackedUrl } from "../src/lib/tracking-url.ts";
import { buildAdmissionFirstComment } from "../src/lib/charlie-viral-skills.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");

// Load env
for (const envFile of [".env.local", ".env"]) {
  const envPath = path.join(root, envFile);
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, "utf-8").split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const idx = trimmed.indexOf("=");
      if (idx === -1) continue;
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
      if (!process.env[key]) process.env[key] = val;
    }
    break;
  }
}

const prisma = new PrismaClient();

async function main() {
  const brandArgIdx = process.argv.indexOf("--brand");
  if (brandArgIdx === -1 || !process.argv[brandArgIdx + 1]) {
    console.error("❌ Error: --brand <slug> argument is required.");
    console.log("Example: npx tsx scripts/brand-generate.mjs --brand cosmicpath --count 5");
    process.exit(1);
  }

  const brandSlug = process.argv[brandArgIdx + 1];
  const countArgIdx = process.argv.indexOf("--count");
  const count = countArgIdx !== -1 ? parseInt(process.argv[countArgIdx + 1], 10) : 5;
  const isDryRun = process.argv.includes("--dry-run");

  const brand = await prisma.brand.findUnique({
    where: { slug: brandSlug },
  });

  if (!brand) {
    console.error(`❌ Error: Brand '${brandSlug}' not found in database.`);
    process.exit(1);
  }

  const brandConfig = JSON.parse(brand.brandConfig || "{}");
  const domainPreset = getDomainPreset(brandConfig.qualityProfile || brandSlug);
  const weights = JSON.parse(brand.formulaWeights || "{}");

  console.log(`\n================================================================`);
  console.log(`🚀 Universal Content Generator: ${brand.name} (${brand.slug})`);
  console.log(`🏷️  Domain Preset: ${domainPreset.name}`);
  console.log(`🎯 Target Count: ${count} posts | Mode: ${isDryRun ? "DRY-RUN (No DB write)" : "LIVE"}`);
  console.log(`================================================================\n`);

  const results = [];
  for (let i = 0; i < count; i++) {
    const selection = selectFormulaWithQuota(i, {
      domainProfile: brandConfig.qualityProfile || brandSlug,
      customWeights: weights,
      recentFormulaIds: results.map((r) => r.formulaId),
    });

    const topic = brandConfig.topics?.[i % (brandConfig.topics?.length || 1)] || domainPreset.defaultTopics[i % domainPreset.defaultTopics.length];
    const landingUrl = brandConfig.productProfile?.landingUrl || brandConfig.websiteUrl || `https://${brand.slug}.app`;
    const trackedUrl = buildTrackedUrl(landingUrl, {
      formulaId: selection.formulaId,
      track: selection.track,
      source: `threads_${brand.slug}`,
    });

    const firstComment = buildAdmissionFirstComment(`Topic: ${topic}`, {
      topic,
      linkUrl: trackedUrl,
      voiceProfile: brandConfig.voiceProfile,
    });

    results.push({
      index: i + 1,
      track: selection.track,
      formulaId: selection.formulaId,
      isExploration: selection.isExploration,
      scheduleTime: selection.scheduleTime,
      topic,
      trackedUrl,
      firstComment,
    });

    console.log(`[#${i + 1}] [${selection.track.toUpperCase()}] Formula: ${selection.formulaId} (${selection.isExploration ? "🔥 MAB Exploration" : "⚡ Exploitation"})`);
    console.log(`     Topic: ${topic}`);
    console.log(`     Tracked Link: ${trackedUrl}`);
    console.log(`     Comment: ${firstComment.split("\n")[0]}...\n`);
  }

  console.log(`================================================================`);
  console.log(`✨ Generated ${results.length} balanced posts for brand: ${brand.slug}`);
  console.log(`================================================================\n`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
