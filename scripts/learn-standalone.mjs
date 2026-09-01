import { PrismaClient } from "@prisma/client";
import { learnBrandGrowth } from "../src/lib/growth-service.ts";

const prisma = new PrismaClient();

async function main() {
  console.log("🧠 Starting growth learning loop for all brands...");
  const brands = await prisma.brand.findMany({ select: { id: true, slug: true, name: true } });

  for (const brand of brands) {
    try {
      console.log(`\nAnalyzing performance patterns for ${brand.name} (${brand.slug})...`);
      const result = await learnBrandGrowth(brand.id);
      console.log(`✓ [${brand.slug}] Learned ${result.learnedPosts} posts.`);
      if (result.promotedFormulas?.length > 0) {
        console.log(`  🔥 Promoted formulas: ${result.promotedFormulas.join(", ")}`);
      }
      if (result.demotedFormulas?.length > 0) {
        console.log(`  ❄️ Demoted formulas: ${result.demotedFormulas.join(", ")}`);
      }
    } catch (err) {
      console.error(`✗ [${brand.slug}] Growth learning failed:`, err instanceof Error ? err.message : err);
    }
  }
}

main()
  .catch((err) => {
    console.error("Fatal:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
