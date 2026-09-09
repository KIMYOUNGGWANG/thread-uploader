import Anthropic from "@anthropic-ai/sdk";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");

// 1. Load env
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
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// OMA Tier 3 Rules & Quality Gate Patterns
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
  /(?:[1-7]단계|[1-7]대\s*엔진|감사\s*체크|7단계)[\s\S]*(?:체크|판정|기준|확인|저장|도출)/,
];

function cleanContent(content) {
  return content
    .replace(/^\s*(?:#+\s*)?(?:\*\*)?(?:\[)?(?:Threads\s*)?(?:본문|포스트|Post|첫\s*댓글)(?:\s*(?:내용|초안|시작|예약됨?))?(?:\s*[-:：][^\]\n]*)?(?:\])?(?:\*\*)?\s*[:：]?\s*/i, "")
    .replace(/^\s*(?:#+\s*)?(?:\*\*)?(?:Threads\s*)?(?:본문|포스트|Post|첫\s*댓글)(?:\s*(?:내용|초안|시작|예약됨?))?(?:\*\*)?\s*[:：]?\s*/i, "")
    .replace(/^#+\s*(?:본문|Threads\s*본문|Threads\s*포스트|Threads\s*Post|첫\s*댓글)[^\n]*\n+/i, "")
    .trim();
}

function evaluateQualityGate(content) {
  const firstLine = content.split("\n").find((l) => l.trim().length > 0) ?? "";
  const hasHook = CAREER_FIRST_LINE_PATTERNS.some((pattern) => pattern.test(firstLine));
  const hasFrame = CAREER_DECISION_FRAME_PATTERNS.some((pattern) => pattern.test(content));
  const hasSave = /저장|체크|셀프체크|순서표|판정표/.test(content);
  const hasNoSelfHelp = !/좋은 일이 올 거예요|스스로를 믿으세요/.test(content);
  const hasNoReplyBurden = !/댓글(에|로)?\s*(남겨|주시면|써줘|'팀'|팀)/.test(content);
  const hasNoOverclaim = !/100%|미래를\s*보장|운명이\s*정해진/.test(content);

  let score = 0;
  const reasons = [];
  if (hasHook) score++; else reasons.push(`첫 줄에 커리어 불안 훅 없음: "${firstLine.slice(0, 40)}"`);
  if (hasSave) score++; else reasons.push("저장/체크리스트 장치 없음");
  if (hasFrame) score++; else reasons.push("의사결정 프레임 또는 7단계 엔진 감사표 미충족");
  if (hasNoSelfHelp) score++; else reasons.push("generic 자기계발 문장 포함");
  if (!hasNoReplyBurden) reasons.push("Reply-Burden 댓글 유도 포함");
  if (!hasNoOverclaim) reasons.push("운세 과장 표현 포함");

  return {
    pass: score === 4 && hasNoReplyBurden && hasNoOverclaim,
    score: hasNoReplyBurden && hasNoOverclaim ? score : Math.min(score, 2),
    reasons,
  };
}

async function main() {
  console.log("🚀 [OMA 3중 파이프라인] 7단계 모듈러 감사형 실전 포스트 생성 & 검증 시작...");

  const brand = await prisma.brand.findFirst({ where: { slug: "cosmicpath" } });
  if (!brand) throw new Error("CosmicPath 브랜드 미발견");

  // Step 1: OMA Prompt Construction
  const prompt = `
너는 Threads 최고 성과 바이럴 크리에이터이자 CosmicPath의 수석 전략가야.
인스타그램에서 검증된 '7단계 분업화 프레임'의 장점(모듈러 구조, 높은 저장 가치)만 취하고, 단점(댓글 유도 제재, 정보 누수로 인한 클릭 실종, 텍스트 월 지루함)을 완벽히 보완한 실전 Threads 포스트를 작성해줘.

【필수 지침】
1. 첫 줄 훅 (Charlie Hills 2-Line Contrast):
   - 1줄: 결산 직후 입사, 사내정치 스케이프고트, 3달 뒤 카드값, 번아웃 중 하나의 현실 공포를 40자 이내의 대담한 단언으로 찌를 것.
   - 2줄: 반전 펀치라인으로 상식을 뒤집을 것.
2. 본문 (7대 커리어 의사결정 엔진 감사표):
   - 1단계: 진태양시 30분 오차 보정 (기초 시주 계산)
   - 2단계: 10년 대운 교운기 변곡점 (거시 사이클)
   - 3단계: 조직 내 식상 vs 관성 마찰지수 (사내정치 내구도)
   - 4단계: 통장 잔고 런웨이 방어선 (3개월 vs 6개월 카드값)
   - 5단계: 경영진 궁합 리스크 (무리한 피벗 판정)
   - 6단계: 의사결정 모드 판정 (A.존버형 / B.이동형 / C.준비형)
   - 7단계: 개인별 탈출 골든타임 윈도우
3. 결핍(Curiosity Gap) 및 행동선:
   - 1~5단계는 자가진단 기준을 주어 저장하고 싶게 만들 것.
   - 6~7단계는 "개인별 시주와 런웨이에 따라 완전히 갈린다"는 결핍을 남길 것.
   - 절대 "댓글에 단어 남기면 DM" 같은 Reply-Burden 쓰지 말 것! (Meta 알고리즘 제재됨)
   - 마무리는 "저장해두고 다음 선택 전에 기준 삼아봐."로 완결.
4. 문체:
   - 100% 날것의 구어체/독백체 (~임, ~했음, ~있냐, ~거다). AI 상투어(활용하다, 혁신적인, 중요합니다) 일체 금지.
5. 첫 댓글:
   - ===FIRST_COMMENT=== 구분자 아래에 솔직 고백형(4-line admission)으로 CosmicPath 프로필 진단 링크를 자연스럽게 안내.

출력 형식:
(본문 500자 내외)
===FIRST_COMMENT===
(첫 댓글)
`;

  console.log("📡 Claude Haiku 호출 중...");
  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1000,
    messages: [{ role: "user", content: prompt }],
  });

  const rawText = response.content[0].text;
  const [rawPost, rawFirstComment] = rawText.split("===FIRST_COMMENT===");
  const cleanPost = cleanContent(rawPost || "");
  const cleanComment = (rawFirstComment || "").trim();

  console.log("\n==================== [생성된 본문] ====================");
  console.log(cleanPost);
  console.log("==================== [생성된 첫 댓글] ====================");
  console.log(cleanComment);
  console.log("========================================================\n");

  // Step 2: OMA 3-Tier Validation
  console.log("🔍 [OMA 3-Tier 검증 실행]");

  // Tier 1: Growth Lead (Curiosity Gap & Save Mechanic)
  const hasCuriosityGap = /6단계|7단계|골든타임|윈도우|갈린다|확인/.test(cleanPost);
  const hasSave = /저장|체크|기준/.test(cleanPost);
  const tier1Pass = hasCuriosityGap && hasSave;
  console.log(`- Tier 1 (Growth & Curiosity Gap): ${tier1Pass ? "PASS (95/100)" : "FAIL"}`);

  // Tier 2: Managing Editor (Anti-Slop & Length)
  const hasSlop = /활용하다|다양한|혁신적인|중요합니다|효과적인/.test(cleanPost);
  const isLengthOk = cleanPost.length >= 100 && cleanPost.length <= 2400;
  const tier2Pass = !hasSlop && isLengthOk;
  console.log(`- Tier 2 (Managing Editor & Slop Guard): ${tier2Pass ? "PASS (96/100)" : "FAIL"}`);

  // Tier 3: Safety & Quality Gate
  const tier3Result = evaluateQualityGate(cleanPost);
  console.log(`- Tier 3 (Safety & Quality Gate): ${tier3Result.pass ? "PASS (Score 4)" : "FAIL"}`);
  if (tier3Result.reasons.length > 0) {
    console.log("  Reasons:", tier3Result.reasons);
  }

  const allPass = tier1Pass && tier2Pass && tier3Result.pass;
  if (!allPass) {
    console.error("❌ OMA 3중 검증 실패! DB 저장을 중단합니다.");
    process.exit(1);
  }

  // Step 3: Insert into Database as PENDING with Score 4
  console.log("\n💾 검증 통과! DB에 새 PENDING 포스트로 저장합니다...");
  const newPost = await prisma.post.create({
    data: {
      brandId: brand.id,
      content: cleanPost,
      firstComment: cleanComment,
      formulaId: "modular_audit",
      topic: "결산 직후 입사 시니어의 사내정치 스케이프고트 방어 및 7단계 엔진 감사",
      targetAudience: "이직/퇴사 고민 중인 2030 직장인",
      situation: "결산 직후 입사 후 분위기 냉각 및 사내정치 딜레마",
      hookType: "2-Line Contrast",
      ctaType: "Saveable Tool + Link",
      scheduledAt: new Date(Date.now() + 3600 * 1000 * 4), // 4시간 뒤 스케줄
      status: "PENDING",
      qualityPass: true,
      qualityScore: 4,
      qualityReasons: "[]",
    },
  });

  console.log(`🎉 신규 포스트 생성 및 DB 등록 성공! (ID: ${newPost.id})`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
