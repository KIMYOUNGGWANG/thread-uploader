/**
 * scripts/brand-audit.mjs
 * Universal multi-brand health, token, queue, and learning memory auditor.
 *
 * Usage:
 *   node scripts/brand-audit.mjs
 *   node scripts/brand-audit.mjs --brand cosmicpath
 *   node scripts/brand-audit.mjs --brand cosmicpath-global
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";

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
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function daysUntil(date) {
  if (!date) return 0;
  return Math.ceil((new Date(date).getTime() - Date.now()) / MS_PER_DAY);
}

async function auditBrand(brand) {
  const posts = await prisma.post.findMany({
    where: { brandId: brand.id },
    orderBy: { createdAt: "desc" },
  });

  const statusCounts = { PUBLISHED: 0, PENDING: 0, FAILED: 0 };
  let totalViews = 0;
  let totalLikes = 0;
  let totalReplies = 0;
  let totalReposts = 0;
  let totalClicks = 0;
  let totalPaidConversions = 0;

  for (const p of posts) {
    statusCounts[p.status] = (statusCounts[p.status] || 0) + 1;
    if (p.status === "PUBLISHED") {
      totalViews += p.views ?? 0;
      totalLikes += p.likes ?? 0;
      totalReplies += p.replies ?? 0;
      totalReposts += p.reposts ?? 0;
      totalClicks += p.clicks ?? 0;
      totalPaidConversions += p.manualPaidConversions ?? 0;
    }
  }

  const tokenDays = daysUntil(brand.tokenExpiry);
  const tokenStatus = tokenDays > 14 ? `✅ ${tokenDays} days valid` : `⚠️ ${tokenDays} days left (Refresh Due)`;

  console.log(`\n================================================================`);
  console.log(`🏷️  Brand: ${brand.name} [slug: ${brand.slug}]`);
  console.log(`🔑 Threads Token: ${tokenStatus}`);
  console.log(`📦 Posts: PUBLISHED (${statusCounts.PUBLISHED}), PENDING (${statusCounts.PENDING}), FAILED (${statusCounts.FAILED})`);
  console.log(`📈 Metrics: Views (${totalViews.toLocaleString()}), Likes (${totalLikes}), Replies (${totalReplies}), Reposts (${totalReposts})`);
  console.log(`💰 Conversions: Clicks (${totalClicks}), Paid Conversions (${totalPaidConversions})`);

  try {
    const weights = JSON.parse(brand.formulaWeights || "{}");
    const sorted = Object.entries(weights).sort(([, a], [, b]) => b - a);
    const topWinners = sorted.slice(0, 3).map(([k, v]) => `${k}(${v})`).join(", ");
    console.log(`🧠 Top Formula Weights: ${topWinners || "None"}`);
  } catch {}

  const nextPending = posts.filter((p) => p.status === "PENDING").slice(-3);
  if (nextPending.length > 0) {
    console.log(`⏳ Upcoming Scheduled Posts:`);
    for (const p of nextPending) {
      console.log(`   - [${new Date(p.scheduledAt).toISOString()}] [${p.formulaId || "default"}] ${p.content.slice(0, 50).replace(/\n/g, " ")}...`);
    }
  }
}

async function main() {
  const brandArgIdx = process.argv.indexOf("--brand");
  const targetSlug = brandArgIdx !== -1 ? process.argv[brandArgIdx + 1] : null;

  const where = targetSlug ? { slug: targetSlug } : {};
  const brands = await prisma.brand.findMany({ where, orderBy: { createdAt: "asc" } });

  if (brands.length === 0) {
    console.log(targetSlug ? `❌ Brand '${targetSlug}' not found.` : `❌ No brands found.`);
    return;
  }

  console.log(`🔍 Auditing ${brands.length} brand(s) in Growth OS...`);
  for (const b of brands) {
    await auditBrand(b);
  }
  console.log(`\n================================================================\n`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
