/**
 * cleanup-global-posts.js
 *
 * CosmicPath Global 브랜드에서 한국어 자모가 포함되었거나
 * 프롬프트 마크다운 태그(# 📌 THREADS POST 등)가 유출된 오염 포스트를
 * 전수 식별하여 격리(ARCHIVED) 처리한다.
 */

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const HANGUL_REGEX = /[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/;
const SLOP_PATTERNS = [
  /#\s*📌\s*THREADS\s*POST/i,
  /---\s*\*\*본문\*\*/i,
  /자수\s*체크/i,
  /===FIRST_COMMENT===/i
];

async function main() {
  const isApply = process.argv.includes("--apply");

  console.log(`[오염 포스트 격리 도구] 실행 모드: ${isApply ? "실제 적용 (APPLY)" : "드라이런 (DRY-RUN)"}`);

  const brand = await prisma.brand.findUnique({
    where: { slug: "cosmicpath-global" },
    include: {
      posts: {
        orderBy: { publishedAt: "desc" }
      }
    }
  });

  if (!brand) {
    console.error("cosmicpath-global 브랜드를 찾을 수 없습니다.");
    return;
  }

  const contaminated = [];

  for (const post of brand.posts) {
    const hasHangul = HANGUL_REGEX.test(post.content) || (post.firstComment && HANGUL_REGEX.test(post.firstComment));
    const hasSlop = SLOP_PATTERNS.some(pattern => pattern.test(post.content) || (post.firstComment && pattern.test(post.firstComment)));

    if (hasHangul || hasSlop) {
      contaminated.push({
        id: post.id,
        status: post.status,
        publishedAt: post.publishedAt,
        hasHangul,
        hasSlop,
        snippet: post.content.replace(/\n/g, " ").substring(0, 80),
        commentSnippet: post.firstComment ? post.firstComment.replace(/\n/g, " ").substring(0, 50) : null
      });
    }
  }

  console.log(`\n총 포스트: ${brand.posts.length}건 | 오염 감지: ${contaminated.length}건`);
  console.log("--------------------------------------------------");

  contaminated.forEach((c, idx) => {
    console.log(`${idx + 1}. [ID: ${c.id}] 상태: ${c.status} | 발행: ${c.publishedAt ? c.publishedAt.toISOString().slice(0, 10) : "미발행"}`);
    console.log(`   사유: ${c.hasHangul ? "[한글 포함] " : ""}${c.hasSlop ? "[AI 메타태그 유출]" : ""}`);
    console.log(`   본문: ${c.snippet}...`);
    if (c.commentSnippet) {
      console.log(`   댓글: ${c.commentSnippet}...`);
    }
    console.log("");
  });

  if (isApply && contaminated.length > 0) {
    const ids = contaminated.map(c => c.id);
    const updateResult = await prisma.post.updateMany({
      where: { id: { in: ids } },
      data: {
        status: "ARCHIVED",
        errorLog: "ISOLATED_BY_CLEANUP: Contaminated with Korean or AI prompt slop"
      }
    });
    console.log(`\n✅ 격리 완료: ${updateResult.count}건의 상태를 ARCHIVED로 변경했습니다.`);
  } else if (!isApply && contaminated.length > 0) {
    console.log("\n💡 실제 DB에 반영하려면 --apply 플래그를 붙여 실행하세요:");
    console.log("   node scripts/cleanup-global-posts.js --apply");
  } else {
    console.log("\n오염된 포스트가 없습니다.");
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
