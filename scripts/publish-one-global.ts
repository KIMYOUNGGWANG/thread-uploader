import { prisma } from "../src/lib/prisma";
import { getFreshBrandCredentials } from "../src/lib/threads-api";
import { publishOrResumePost } from "../src/lib/threads/thread-resume-engine";

async function main() {
  const brand = await prisma.brand.findUnique({
    where: { slug: "cosmicpath-global" },
  });

  if (!brand) {
    throw new Error("Brand cosmicpath-global not found");
  }

  // Find the next pending post
  const post = await prisma.post.findFirst({
    where: {
      brandId: brand.id,
      status: "PENDING",
    },
    orderBy: { scheduledAt: "asc" },
  });

  if (!post) {
    throw new Error("No pending post found for cosmicpath-global");
  }

  console.log(`[즉시 발행 시작]`);
  console.log(`브랜드: ${brand.name} (@${brand.threadsUserId})`);
  console.log(`포스트 ID: ${post.id}`);
  console.log(`주제: ${post.topic}`);
  console.log(`본문 미리보기:\n${post.content.slice(0, 100)}...`);
  console.log(`첫 댓글: ${post.firstComment || "없음"}`);

  console.log(`\nMeta Threads 자격 증명 획득 중...`);
  const credentials = await getFreshBrandCredentials(brand.id);
  console.log(`자격 증명 확인 완료 (User ID: ${credentials.userId})`);

  console.log(`\nThreads API 발행 요청 전송 중...`);
  const result = await publishOrResumePost(post.id, credentials, {
    delayBetweenPartsMs: 3000,
  });

  console.log(`\n발행 결과:`, result);

  if (result.success && result.rootThreadsId) {
    const updated = await prisma.post.findUnique({
      where: { id: post.id },
      select: {
        id: true,
        status: true,
        threadsId: true,
        publishedAt: true,
      },
    });
    console.log(`\n🎉 성공적으로 발행되었습니다!`);
    console.log(`DB 레코드:`, updated);
    console.log(`스레드 링크: https://www.threads.net/@cosmicpath.global/post/${result.rootThreadsId}`);
  } else {
    throw new Error(`발행 실패: ${result.error}`);
  }
}

main()
  .catch((e) => {
    console.error("발행 실패:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
