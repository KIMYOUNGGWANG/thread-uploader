// Weekly New Year 2027 season report (read-only: findMany only, no writes).
// Per brand x New Year type: posts, median views, link clicks per 1,000 views, paid conversions;
// plus each brand's normal-post median views and Threads-attributed paid conversions.
// Usage: node scripts/new-year-report.mjs
//        node scripts/new-year-report.mjs --self-test   (no database needed)
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const BRANDS = ["cosmicpath", "cosmicpath-global"];
const NY_TYPES = ["ny_ranking", "ny_ipchun", "ny_monthly", "ny_pick"];
const FROM = new Date("2026-11-24T00:00:00+09:00");
const TO = new Date("2027-02-07T00:00:00+09:00"); // exclusive: 2027-02-06 KST end of day

const sum = (xs) => xs.reduce((a, b) => a + b, 0);
function median(xs) {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

// posts: { id, brand, formulaId, views, clicks }[]; conversions: { postId }[] (paid only)
export function summarize(posts, conversions) {
  const paidByPost = new Map();
  for (const c of conversions) paidByPost.set(c.postId, (paidByPost.get(c.postId) ?? 0) + 1);
  const rows = [];
  const normalMedian = {};
  let totalPaid = 0;
  for (const brand of [...new Set(posts.map((p) => p.brand))]) {
    const mine = posts.filter((p) => p.brand === brand);
    normalMedian[brand] = median(
      mine.filter((p) => !NY_TYPES.includes(p.formulaId) && p.views != null).map((p) => p.views),
    );
    for (const type of NY_TYPES) {
      const g = mine.filter((p) => p.formulaId === type);
      if (!g.length) continue;
      const measured = g.filter((p) => p.views != null && p.clicks != null);
      const views = sum(measured.map((p) => p.views));
      const paid = sum(g.map((p) => paidByPost.get(p.id) ?? 0));
      totalPaid += paid;
      rows.push({
        brand,
        type,
        posts: g.length,
        medianViews: median(g.filter((p) => p.views != null).map((p) => p.views)),
        clicksPer1k: views ? (sum(measured.map((p) => p.clicks)) / views) * 1000 : null,
        paid,
      });
    }
  }
  return { rows, normalMedian, totalPaid };
}

if (process.argv.includes("--self-test")) {
  const posts = [
    { id: "a", brand: "cosmicpath", formulaId: "ny_ranking", views: 100, clicks: 5 },
    { id: "b", brand: "cosmicpath", formulaId: "ny_ranking", views: 300, clicks: 3 },
    { id: "c", brand: "cosmicpath", formulaId: "ny_pick", views: 200, clicks: 2 },
    { id: "d", brand: "cosmicpath", formulaId: "plain", views: 50, clicks: 0 },
  ];
  const s = summarize(posts, [{ postId: "a" }, { postId: "c" }]);
  const rank = s.rows.find((r) => r.type === "ny_ranking");
  assert.equal(rank.posts, 2);
  assert.equal(rank.medianViews, 200);
  assert.equal(rank.clicksPer1k, 20);
  assert.equal(rank.paid, 1);
  assert.equal(s.rows.find((r) => r.type === "ny_pick").paid, 1);
  assert.equal(s.normalMedian.cosmicpath, 50);
  assert.equal(s.totalPaid, 2);
  console.log("self-test ok");
  process.exit(0);
}

// Load env (same approach as brand-audit.mjs); credentials are never printed.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
for (const envFile of [".env.local", ".env"]) {
  const envPath = path.join(root, envFile);
  if (!fs.existsSync(envPath)) continue;
  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const t = line.trim();
    const i = t.indexOf("=");
    if (!t || t.startsWith("#") || i === -1) continue;
    const key = t.slice(0, i).trim();
    if (!process.env[key]) process.env[key] = t.slice(i + 1).trim().replace(/^["']|["']$/g, "");
  }
  break;
}

const { PrismaClient } = await import("@prisma/client");
const prisma = new PrismaClient();
try {
  const rawPosts = await prisma.post.findMany({
    where: { brand: { slug: { in: BRANDS } }, publishedAt: { gte: FROM, lt: TO } },
    select: { id: true, formulaId: true, views: true, clicks: true, brand: { select: { slug: true } } },
  });
  const posts = rawPosts.map((p) => ({ ...p, brand: p.brand.slug }));
  const nyIds = posts.filter((p) => NY_TYPES.includes(p.formulaId)).map((p) => p.id);
  const conversions = await prisma.conversionEvent.findMany({
    where: { eventType: "paid_conversion", postId: { in: nyIds }, createdAt: { gte: FROM, lt: TO } },
    select: { postId: true },
  });
  const { rows, normalMedian, totalPaid } = summarize(posts, conversions);
  const f = (n, d = 0) => (n == null ? "-" : n.toFixed(d));
  console.log("brand\ttype\tposts\tmedian_views\tclicks_per_1k_views\tpaid");
  for (const r of rows) console.log([r.brand, r.type, r.posts, f(r.medianViews), f(r.clicksPer1k, 1), r.paid].join("\t"));
  console.log("\nnormal-post median views (same period)");
  for (const [b, m] of Object.entries(normalMedian)) console.log(`${b}\t${f(m)}`);
  const unattributed = await prisma.conversionEvent.count({
    where: { eventType: "paid_conversion", postId: null, brand: { slug: { in: BRANDS } }, createdAt: { gte: FROM, lt: TO } },
  });
  console.log(`\nThreads-attributed paid conversions (ny_* posts): ${totalPaid}`);
  console.log(`unattributed paid conversions (postId null, same window/brands): ${unattributed}`);
  console.log("note: the 100-sale goal counts ALL 2027 calendar sales; check total sales in the cosmicpath admin.");
} finally {
  await prisma.$disconnect();
}
