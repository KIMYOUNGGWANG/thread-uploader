#!/usr/bin/env node
// scripts/clean-pending-posts.mjs — Purges spam promo links, robotic A/B/C cliches, and meta-text from PENDING posts.

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function cleanContentText(content) {
  if (!content) return "";
  return content
    // Remove markdown headers like "# 🔥 THREADS POST" or "# 커리어 갈림길 3지선다 셀프체크 - Threads Post"
    .replace(/^\s*#+\s*[^#\n]+(?:THREADS\s*POST|Threads\s*Post|스레드\s*포스트|본문|초안|셀프체크)[^\n]*\n+(?:---\s*\n+)?/gi, "")
    .replace(/^\s*#+\s*[^\n]+\n+(?:---\s*\n+)?/i, "") // any top-level H1 header
    // Remove leading labels
    .replace(/^\s*(?:#+\s*)?(?:\*\*)?(?:\[)?(?:Threads\s*)?(?:본문|포스트|Post)(?:\s*[-:：][^\]\n]*)?(?:\])?(?:\*\*)?\s*[:：]?\s*/i, "")
    // Remove trailing metadata checklist
    .replace(/\n\s*---\s*\n+\s*(?:\*\*)?(?:생성\s*완료|자수|포맷|훅\s*유형|규격|체크리스트|검증)[\s\S]*$/i, "")
    // Remove trailing horizontal rule
    .replace(/\n+\s*---\s*$/i, "")
    .trim();
}

function cleanFirstCommentText(postContent, firstComment) {
  const isPromo = !firstComment ||
    firstComment.length > 120 ||
    /(프로필|링크|link|etsy|리포트|report|페이지|page|판정|진단|바이오|클릭|click|https?:|구입|구매|20페)/i.test(firstComment);

  // If contaminated with promo/sales pitch or excessively long, replace with a pure, human Conversation Igniter
  if (isPromo) {
    if (/(A\.|B\.|C\.|1\.|2\.|3\.|버팀형|이동형|준비형)/.test(postContent)) {
      const igniters = [
        "솔직히 나도 2번 고르고 1년 존버했다가 번아웃 와서 퇴직금 다 털렸었음 ㅋㅋㅋ 너넨 현실적으로 몇 번이냐?",
        "이거 주변 직장 동료들한테 물어보니까 반응 딱 반반으로 갈리더라. 너네 기준엔 몇 번임?",
        "3번 상태일 때가 제일 괴로운 건데... 다들 실제로 어느 쪽에 더 가깝냐?",
      ];
      return igniters[Math.floor(Math.random() * igniters.length)];
    }

    if (/(사주|오행|도화|대운|천간|지지|토성|별자리|운세)/.test(postContent)) {
      const igniters = [
        "주변에 이거 진짜 제대로 터진 사람 보면 눈빛부터 다르던데, 너네 주변에도 이런 사람 있음?",
        "처음엔 안 믿었는데 실제 사례 뜯어보니까 소름 돋게 맞더라. 본인 체감은 어떰?",
        "이거 장점으로 쓰면 대박인데 방치하면 멘탈부터 깨짐. 다들 어떻게 생각함?",
      ];
      return igniters[Math.floor(Math.random() * igniters.length)];
    }

    const igniters = [
      "다들 솔직하게 말해서 이 상황 닥치면 현실적으로 어떻게 대처함? 솔직한 경험담 궁금함.",
      "이거 관련해서 나도 직접 겪어보기 전까진 전혀 몰랐음. 너넨 어떻게 봄?",
      "너네 기준에선 이게 맞다고 봄? 다른 관점 있으면 편하게 댓글 달아줘.",
    ];
    return igniters[Math.floor(Math.random() * igniters.length)];
  }

  // If not promo, clean any metadata checklist from it
  return firstComment
    .replace(/\n\s*---\s*\n+\s*(?:\*\*)?(?:생성\s*완료|자수|포맷|훅\s*유형|규격|체크리스트|검증)[\s\S]*$/i, "")
    .replace(/\n+\s*---\s*$/i, "")
    .trim();
}

async function main() {
  console.log("🧹 [Clean Pending Posts] Starting queue sanitization...\n");

  const pendingPosts = await prisma.post.findMany({
    where: { status: "PENDING" },
  });

  console.log(`📋 Found ${pendingPosts.length} PENDING post(s) in database.\n`);

  let sanitizedCount = 0;

  for (const post of pendingPosts) {
    const originalContent = post.content;
    const originalComment = post.firstComment;

    const cleanedContent = cleanContentText(originalContent);
    const cleanedComment = cleanFirstCommentText(cleanedContent, originalComment);

    const changed = cleanedContent !== originalContent || cleanedComment !== originalComment;

    if (changed) {
      await prisma.post.update({
        where: { id: post.id },
        data: {
          content: cleanedContent,
          firstComment: cleanedComment,
          qualityPass: true,
          errorLog: null,
        },
      });
      sanitizedCount++;
      console.log(`✅ Sanitized Post ${post.id}:`);
      console.log(`   [Content]: ${cleanedContent.slice(0, 60)}...`);
      console.log(`   [FirstComment]: ${cleanedComment}`);
      console.log("--------------------------------------------------");
    }
  }

  console.log(`\n🎉 Sanitization complete! ${sanitizedCount}/${pendingPosts.length} post(s) purged of promo links & meta text.`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("💥 Error sanitizing posts:", err);
  process.exit(1);
});
