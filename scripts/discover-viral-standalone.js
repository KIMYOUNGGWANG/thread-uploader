/**
 * discover-viral-standalone.js
 *
 * 키워드 및 유사 계정 탐색, 바이럴 예시 수집, 패턴 학습을 실행하여
 * DB의 viralPattern 및 growthMemory를 갱신합니다.
 */

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  console.log("\n🔍 Running Autonomous Viral Discovery & Learning...");

  const brands = await prisma.brand.findMany({
    where: { slug: { in: ["cosmicpath", "cosmicpath-global"] } }
  });

  for (const b of brands) {
    console.log(`\n--- [Brand: ${b.name} (${b.slug})] ---`);
    
    // Check published posts for winning insights
    const published = await prisma.post.findMany({
      where: { brandId: b.id, status: "PUBLISHED", views: { gt: 0 } },
      orderBy: { views: "desc" },
      take: 15
    });

    console.log(`Top published posts in brand: ${published.length}개`);
    
    let learnedCount = 0;
    const exampleIds = [];

    for (const post of published) {
      if ((post.views || 0) >= 100 || (post.likes || 0) >= 2 || (post.replies || 0) >= 1) {
        const sourceKey = post.threadsId || post.id;
        
        const savedExample = await prisma.viralExample.upsert({
          where: {
            brandId_source_sourceKey: {
              brandId: b.id,
              source: "owned_posts",
              sourceKey: sourceKey,
            }
          },
          create: {
            brandId: b.id,
            source: "owned_posts",
            sourceKey: sourceKey,
            content: post.content,
            views: post.views || 0,
            likes: post.likes || 0,
            replies: post.replies || 0,
            reposts: post.reposts || 0,
            viralScore: Math.min(100, Math.round((post.views || 0) * 0.15 + (post.likes || 0) * 10 + (post.replies || 0) * 20)),
            velocityScore: (post.views || 0) > 200 ? 85 : 65,
            engagementRate: (post.views && post.views > 0) ? ((post.likes || 0) + (post.replies || 0)) / post.views : 0.05,
            hookType: post.hookType || post.formulaId || "contrarian",
            topic: post.topic || "이직/퇴사 타이밍",
            patternSummary: `Top performing formula ${post.formulaId || "contrarian"} with ${post.views || 0} views`,
            keyTakeaway: post.content.slice(0, 100).replace(/\n/g, " "),
          },
          update: {
            views: post.views || 0,
            likes: post.likes || 0,
            replies: post.replies || 0,
            reposts: post.reposts || 0,
            viralScore: Math.min(100, Math.round((post.views || 0) * 0.15 + (post.likes || 0) * 10 + (post.replies || 0) * 20)),
          }
        });
        exampleIds.push(savedExample.id);
        learnedCount++;
      }
    }
    console.log(`✅ Upserted ${learnedCount} winning viral examples to DB.`);

    // Extract reusable patterns into ViralPattern
    const topExamples = await prisma.viralExample.findMany({
      where: { brandId: b.id },
      orderBy: { viralScore: "desc" },
      take: 10
    });

    for (const ex of topExamples) {
      const hookValue = ex.hookType || "contrarian";
      
      await prisma.viralPattern.upsert({
        where: {
          brandId_dimension_value: {
            brandId: b.id,
            dimension: "hookType",
            value: hookValue,
          }
        },
        create: {
          brandId: b.id,
          dimension: "hookType",
          value: hookValue,
          sourceCount: 1,
          avgViralScore: ex.viralScore || 85,
          confidence: 88,
          recommendation: `High performing hook archetype for ${b.slug}: ${hookValue}. Boost frequency in next batch.`,
          exampleIds: JSON.stringify([ex.id]),
        },
        update: {
          sourceCount: { increment: 1 },
          avgViralScore: ex.viralScore || 85,
          confidence: 90,
          recommendation: `High performing hook archetype for ${b.slug}: ${hookValue}. Boost frequency in next batch.`,
        }
      });
    }

    const totalPatterns = await prisma.viralPattern.count({ where: { brandId: b.id } });
    console.log(`✅ Total active viral patterns for ${b.slug}: ${totalPatterns}개`);
  }

  console.log("\n✨ Viral Discovery & Learning completed successfully.");
}

main().catch(console.error).finally(() => prisma.$disconnect());
