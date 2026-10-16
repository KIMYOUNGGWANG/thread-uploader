// Read-only snapshot of published posts + metrics for offline analysis.
// Usage: node --env-file=.env scripts/export-post-metrics.mjs [outPath]
import { PrismaClient } from "@prisma/client";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const prisma = new PrismaClient();
// Local date (sv-SE = YYYY-MM-DD), so the name matches `$(date +%Y-%m-%d)`; UTC lags a day before 09:00 KST.
const outPath = process.argv[2] ?? `.data/analysis/post-metrics-${new Date().toLocaleDateString("sv-SE")}.json`;

async function main() {
  const brands = await prisma.brand.findMany({ select: { id: true, slug: true, growthMemory: true } });
  const snapshot = { exportedAt: new Date().toISOString(), brands: [] };

  for (const brand of brands) {
    const posts = await prisma.post.findMany({
      where: { brandId: brand.id, status: "PUBLISHED" },
      orderBy: { publishedAt: "asc" },
      select: {
        id: true, threadsId: true, content: true, firstComment: true, imageUrls: true,
        createdAt: true, publishedAt: true, metricsAt: true, views: true, likes: true, replies: true, reposts: true,
        clicks: true, conversions: true, performanceScore: true,
        formulaId: true, topic: true, targetAudience: true, situation: true, hookType: true, ctaType: true,
        postCategory: true, campaignId: true, linkUrl: true, threadTotalParts: true,
        qualityScore: true, algorithmicScore: true, rewriteCount: true,
      },
    });
    if (!posts.length) continue;
    const accountInsights = await prisma.accountInsight.findMany({
      where: { brandId: brand.id },
      orderBy: { generatedAt: "asc" },
      select: { generatedAt: true, metrics: true },
    });
    snapshot.brands.push({
      slug: brand.slug,
      growthMemory: JSON.parse(brand.growthMemory || "{}"),
      accountInsights: accountInsights.map((row) => ({ generatedAt: row.generatedAt, metrics: JSON.parse(row.metrics || "{}") })),
      posts,
    });
  }

  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(snapshot, null, 2));
  for (const brand of snapshot.brands) {
    console.log(`${brand.slug}: ${brand.posts.length} posts, ${brand.accountInsights.length} account insights`);
  }
  console.log(`wrote ${outPath}`);
}

main()
  .catch((error) => { console.error(error); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
