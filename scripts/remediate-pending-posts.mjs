import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");

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

const CAREER_FIRST_LINE_PATTERNS = [
  /이직/, /퇴사/, /버틸지/, /옮길지/, /번아웃/, /그만둘지/, /커리어/, /직장/, /회사/,
  /월급/, /통장/, /잔고/, /카드값/, /돈/, /현타/, /동기/, /제자리/, /뒤처/, /때려치우/,
  /일도\s*다\s*놓/, /출근/, /연봉/, /승진/, /상사/, /업무/, /동업/, /피벗/, /스타트업/,
  /창업/, /사업/, /대표/, /팀/, /조직/, /사주/, /운세/, /대운/, /멘탈/, /화병/, /존버/,
  /대박/, /오열/, /선택/, /성과/, /프리랜서/,
  /결산/, /입사/, /신입/, /스케이프고트/, /왕따/, /투자/, /아키텍트/, /파트너/, /손절/,
];

const CAREER_DECISION_FRAME_PATTERNS = [
  /버팀형[\s\S]*이동형[\s\S]*준비형/,
  /버티[\s\S]*나가[\s\S]*준비/,
  /버텨야[\s\S]*움직여야[\s\S]*준비/,
  /버티고\s*있는지[\s\S]*나가야[\s\S]*준비/,
  /세\s*가지로?\s*갈린/,
  /3가지로?\s*나뉘/,
  /어느\s*쪽인지/,
  /어느\s*쪽에\s*가까/,
  /어디에\s*해당/,
  /어떤\s*유형/,
  /당신의\s*선택/,
  /(버티|존버|잔류)[\s\S]*(이직|퇴사|이동)[\s\S]*(준비|정리|탐색)/,
  /[ABC123①②③]\s*(?:형)?\s*[\.\:\-\)]\s*[\s\S]*[ABC123①②③]\s*(?:형)?\s*[\.\:\-\)]/i,
  /(어디인가|어디야|어디에\s*있|어디\s*가까|어디\s*느껴|어느\s*지점|가장\s*가까운\s*곳|가장\s*가까운\s*쪽)/,
];

function cleanContent(content) {
  let cleaned = content
    .replace(/^\s*(?:#+\s*)?(?:\*\*)?(?:\[)?(?:Threads\s*)?(?:본문|포스트|Post|첫\s*댓글)(?:\s*(?:내용|초안|시작|예약됨?))?(?:\s*[-:：][^\]\n]*)?(?:\])?(?:\*\*)?\s*[:：]?\s*/i, "")
    .replace(/^\s*(?:#+\s*)?(?:\*\*)?(?:Threads\s*)?(?:본문|포스트|Post|첫\s*댓글)(?:\s*(?:내용|초안|시작|예약됨?))?(?:\*\*)?\s*[:：]?\s*/i, "")
    .replace(/^#+\s*(?:본문|Threads\s*본문|Threads\s*포스트|Threads\s*Post|첫\s*댓글)[^\n]*\n+/i, "")
    .trim();

  if (cleaned.includes("무조건 떠남")) {
    cleaned = cleaned.replace("무조건 떠남", "일단 떠남");
  }

  return cleaned;
}

function evaluateQuality(content) {
  const firstLine = content.split("\n").find((l) => l.trim().length > 0) ?? "";
  const hasHook = CAREER_FIRST_LINE_PATTERNS.some((pattern) => pattern.test(firstLine));
  const hasFrame = CAREER_DECISION_FRAME_PATTERNS.some((pattern) => pattern.test(content));
  const hasSave = /저장|체크|셀프체크/.test(content);
  const hasNoSelfHelp = !/좋은 일이 올 거예요|스스로를 믿으세요/.test(content);

  let score = 0;
  const reasons = [];
  if (hasHook) score++; else reasons.push(`첫 줄에 커리어 불안 없음: "${firstLine.slice(0, 40)}"`);
  if (hasSave) score++; else reasons.push("low-touch 자기분류/저장/공유 장치 없음");
  if (hasFrame) score++; else reasons.push("버팀형/이동형/준비형 중 하나로 분류하기 어려움");
  if (hasNoSelfHelp) score++; else reasons.push("generic 자기계발 문장 포함");

  return {
    pass: score === 4,
    score,
    reasons,
  };
}

async function main() {
  const posts = await prisma.post.findMany({
    where: { brandId: "cmqpj5tjf0002eize6v2ui2lg", status: "PENDING" },
    orderBy: { createdAt: "desc" },
  });

  console.log(`Found ${posts.length} PENDING posts for CosmicPath.\n`);
  let updatedCount = 0;

  for (let i = 0; i < posts.length; i++) {
    const post = posts[i];
    const cleaned = cleanContent(post.content);
    const evalResult = evaluateQuality(cleaned);

    console.log(`[${i + 1}/${posts.length}] ID: ${post.id}`);
    console.log(`  Before: pass=${post.qualityPass}, score=${post.qualityScore}, reasons=${post.qualityReasons}`);
    console.log(`  After:  pass=${evalResult.pass}, score=${evalResult.score}, reasons=${JSON.stringify(evalResult.reasons)}`);

    if (evalResult.pass) {
      await prisma.post.update({
        where: { id: post.id },
        data: {
          content: cleaned,
          qualityPass: true,
          qualityScore: 4,
          qualityReasons: "[]",
        },
      });
      updatedCount++;
    } else {
      console.error(`  ⚠️ Post ${post.id} failed re-evaluation:`, evalResult.reasons);
    }
  }

  console.log(`\nSuccessfully updated ${updatedCount}/${posts.length} posts to Quality PASS (Score 4).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
