/**
 * fetch-metrics-standalone.js
 *
 * PUBLISHED 게시물의 Threads Insights(조회수·좋아요·댓글·리포스트)를
 * 공식 Meta Graph API로 수집해 DB에 저장한다.
 *
 * 수집 대상: 게시 후 2일~7일 사이인 게시물 (성과 안정화 구간)
 * GitHub Actions에서 매일 1회 실행된다.
 */

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const THREADS_API_BASE = "https://graph.threads.net/v1.0";
const BATCH_SIZE = 20;
const REQUEST_DELAY_MS = 600; // Threads API rate limit 여유

async function fetchInsights(threadsId, accessToken) {
  const params = new URLSearchParams({
    metric: "views,likes,replies,reposts,quotes",
    access_token: accessToken,
  });

  const response = await fetch(
    `${THREADS_API_BASE}/${threadsId}/insights?${params}`
  );
  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      `Insights API error (${response.status}): ${data.error?.message ?? "Unknown"}`
    );
  }

  const metrics = {};
  for (const item of data.data ?? []) {
    // Meta API 응답 형식: { name, values: [{ value }] }
    metrics[item.name] = item.values?.[0]?.value ?? 0;
  }

  return {
    views: metrics.views ?? 0,
    likes: metrics.likes ?? 0,
    replies: metrics.replies ?? 0,
    reposts: metrics.reposts ?? 0,
  };
}

async function main() {
  const settings = await prisma.settings.findUnique({ where: { id: "default" } });
  if (!settings?.accessToken) {
    throw new Error("Threads 설정이 DB에 없습니다. 먼저 초기화하세요.");
  }

  const now = Date.now();
  const TWO_DAYS = 2 * 24 * 60 * 60 * 1000;
  const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;

  // 게시 후 2일~7일 사이 && 아직 메트릭 수집 안 된 게시물
  const posts = await prisma.post.findMany({
    where: {
      status: "PUBLISHED",
      threadsId: { not: null },
      metricsAt: null,
      createdAt: {
        gte: new Date(now - SEVEN_DAYS),
        lte: new Date(now - TWO_DAYS),
      },
    },
    orderBy: { createdAt: "asc" },
    take: BATCH_SIZE,
  });

  console.log(`\n🔍 메트릭 수집 대상: ${posts.length}개`);

  if (posts.length === 0) {
    console.log("수집할 게시물 없음. 종료.");
    return;
  }

  let success = 0;
  let errors = 0;

  for (const post of posts) {
    try {
      const insights = await fetchInsights(post.threadsId, settings.accessToken);

      await prisma.post.update({
        where: { id: post.id },
        data: {
          views: insights.views,
          likes: insights.likes,
          replies: insights.replies,
          reposts: insights.reposts,
          metricsAt: new Date(),
        },
      });

      console.log(
        `✓ ${post.id} (${post.formulaId ?? "unknown"}) | ` +
        `views=${insights.views} likes=${insights.likes} ` +
        `replies=${insights.replies} reposts=${insights.reposts}`
      );
      success++;
    } catch (error) {
      console.error(`✗ ${post.id}: ${error.message}`);
      errors++;
    }

    // Rate limit 방지
    await new Promise((resolve) => setTimeout(resolve, REQUEST_DELAY_MS));
  }

  console.log(`\n완료: 성공 ${success}개, 실패 ${errors}개`);
}

main()
  .catch((error) => {
    console.error("Fatal:", error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
