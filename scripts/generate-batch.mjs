/**
 * generate-batch.mjs
 * 범용 브랜드 파라미터 기반 Threads 포스트 배치 생성기
 *
 * 사용법:
 *   node scripts/generate-batch.mjs [options]
 *
 * 옵션:
 *   --brand <path>    brand-voice.md 경로 (기본: .agent/memory/brand-voice.md)
 *   --count <n>       생성할 포스트 수 (기본: 60)
 *   --stunt <name>    스턴트 전략명 (없으면 자동 선택)
 *   --output <path>   출력 파일 경로 (기본: output/YYYY-MM-DD-batch.md)
 */

import Anthropic from "@anthropic-ai/sdk";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const EXPERT_PANEL_REF = path.resolve(root, ".agent/skills/threads-engine/references/expert-panel.md");
const expertPanelGuide = fs.readFileSync(EXPERT_PANEL_REF, "utf-8");

// ── env 로드 ──────────────────────────────────────────────────────────────
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
    console.log(`✅ env loaded: ${envFile}`);
    break;
  }
}

if (!process.env.ANTHROPIC_API_KEY) {
  console.error("❌ ANTHROPIC_API_KEY가 없습니다. .env.local을 확인하세요.");
  process.exit(1);
}

// ── 인수 파싱 ──────────────────────────────────────────────────────────────
function parseArgs(args) {
  const result = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith("--") && i + 1 < args.length) {
      result[args[i]] = args[i + 1];
      i++;
    }
  }
  return result;
}

const args = parseArgs(process.argv.slice(2));

const BRAND_FILE = path.resolve(root, args["--brand"] ?? ".agent/memory/brand-voice.md");
const COUNT = parseInt(args["--count"] ?? "60", 10);
const STUNT = args["--stunt"] ?? null;
const dateStr = new Date().toISOString().slice(0, 10);
const OUTPUT = path.resolve(
  root,
  args["--output"] ?? path.join("output", `${dateStr}-batch.md`)
);

// ── brand-voice.md 읽기 ───────────────────────────────────────────────────
if (!fs.existsSync(BRAND_FILE)) {
  console.error(`❌ brand-voice.md를 찾을 수 없습니다: ${BRAND_FILE}`);
  console.error("   먼저 /viral-setup을 실행해주세요.");
  process.exit(1);
}

const brandVoice = fs.readFileSync(BRAND_FILE, "utf-8");

// 브랜드명 추출 (첫 번째 # 헤더에서)
const brandNameMatch = brandVoice.match(/^#\s+Brand Voice\s+[—-]\s+(.+)$/m);
const brandName = brandNameMatch ? brandNameMatch[1].trim() : "브랜드";

const stuntContext = STUNT
  ? `\n【이번 배치 스턴트 전략】\n${STUNT} 템플릿을 중심으로 포스트를 작성해. 이 스턴트의 구조와 원칙을 자연스럽게 반영해.`
  : "";

// ── 상수 ──────────────────────────────────────────────────────────────────
const SEPARATOR = "===FIRST_COMMENT===";
const META_SEP = "===META===";
const BATCH = 2;
const COOLDOWN = 800;
const RETRIES = 5;
const BASE_DELAY = 3000;
const RETRYABLE = new Set([429, 529]);

// ── 포스트 공식 ────────────────────────────────────────────────────────────
const FORMULAS = [
  {
    id: "warning",
    name: "경고/위험 회피",
    weight: 4,
    instruction: `특정 타깃이 반드시 조심해야 할 것을 경고하는 포스트.
훅: "[타깃]이 반드시 조심해야 할 [N]가지" 또는 "[타깃]라면 [위험] 지금 당장 확인해" 형식.
리스트(1. 2. 3.) 또는 단락형으로 위험 신호 2-4개 나열.
각 항목은 구체적인 상황/행동 묘사 포함 — 추상적 경고 금지.
반드시 마지막 줄에 CTA 삽입: "해당되면 저장해" 또는 "주변에 [타깃] 있으면 공유해줘".
톤: 공포 유발이 아니라 "알고 대비하면 막을 수 있어" 따뜻한 경고. 나쁜 결과보다 좋아지는 방향 강조.
예시 패턴: "[타깃]이라면 [특정 행동]은 독이야. 왜냐면 [이유]. 대신 [해결책]."`
  },
  {
    id: "contrarian",
    name: "반직관 훅",
    weight: 3,
    instruction: `모두가 당연하게 믿는 상식을 정면으로 반박.
구조: "[상식] = [오해]? (X) → 진짜는 [반전] (O)" 패턴을 기본으로 사용.
반박 근거 2-3개 제시. 의도적으로 반박 여지를 남겨서 댓글 유발.
마무리: "반박시 니 말이 맞음" 또는 "틀렸다고 생각하면 댓글 달아봐" 활용 가능.
사주/타로 관련 흔한 오해를 정면으로 뒤집는 것이 특히 효과적.
예시: "도화살 = 바람기? (X) → 연예인급 인기 (O)", "타로 Death 카드 = 죽음? (X) → 새로운 시작 (O)"`
  },
  {
    id: "choice",
    name: "편가르기",
    weight: 3,
    instruction: `극적인 상황을 설정하고 반드시 딱 3개의 선택지를 줘. (4개 이상 금지)
1번과 2번은 예측 가능한 답. 3번은 반드시 반전/의외/웃긴 답이어야 함.
질문으로 끝내지 말 것 — 선택지만 던지면 독자가 자연히 댓글로 반응함.
도입부는 매번 완전히 다른 구조로 작성. ("자, 상상해봐" 표현 절대 금지)
오프닝 예시: 상황 묘사, 팩트 폭격, 질문 없는 딜레마 설정 등 다양하게."`
  },
  {
    id: "reveal",
    name: "반전 폭로",
    weight: 3,
    instruction: `"A인 줄 알았는데 → 사실은 B, 근데 진짜는 C" 단계적 반전 구조.
독자가 당연하게 생각하는 결론을 1단계 뒤집고, 다시 2단계 뒤집어 진짜 핵심 도달.
매번 전혀 다른 문장 구조로 시작할 것.
마무리: "너도 혹시 이거 해당되는지 확인해봐" 또는 "알고 있었어?" 형식으로 독자 확인 유도.
예시: "연애운 좋다 = 사랑이 온다 (X) = 내가 덜 흔들린다 (O). 이거 모르면 운세 봐도 소용없어."`
  },
  {
    id: "thisorthat",
    name: "양자택일",
    weight: 2,
    instruction: `극단적으로 다른 두 유형의 일상 행동/반응을 대비. 단순 설명 말고 생생한 장면 묘사.
유형 A의 행동 2-3개 나열 → 유형 B의 행동 2-3개 나열 → 마지막에 "넌 어느 쪽이야?" 또는 "댓글로 A/B 달아줘" 유도.
도입부: 매 포스트마다 완전히 다른 일상 상황/말투로 시작. "두 종류의 사람이 있어" 표현 반복 금지.
예시: "고민 생기면 일단 검색하는 사람 vs 일단 자는 사람. 넌 어느 쪽이야?"`
  },
  {
    id: "check",
    name: "해당여부 확인",
    weight: 2,
    instruction: `특정 조건/특징 목록을 나열하며 독자 스스로 체크하게 만드는 포스트.
"이거 있어?" "해당돼?" "깔려있어?" 형식으로 2-4개 조건 제시.
결론은 둘 중 하나: "이게 다 해당되면 넌 [특별한 것]이야" 또는 "이 중 2개 이상이면 조심해야 해".
사주 살(殺) 시리즈에 특히 강력: 관살혼잡, 고란살, 홍염살, 역마살, 도화살, 귀문관살 등 활용 가능.
마무리: 자신이 해당되는지 댓글로 공유하게 유도하거나 저장 유도."`
  },
  {
    id: "save",
    name: "저장형 정리",
    weight: 2,
    instruction: `앱/서비스 없이도 독립적으로 쓸 수 있는 실용 정보를 정리한 포스트.
반드시 다음 3가지 형식 중 하나 선택:
  (A) 비교표: "A형 vs B형" 또는 "X할 때 vs Y할 때" 2열 대비
  (B) 단계별 방법론: "1단계 → 2단계 → 3단계" 순서형
  (C) 체크리스트: 조건/특징 3-5개 불릿 나열
수치와 구체적 예시 필수. 추상적 조언 금지.
마지막 줄: "저장해두고 나중에 꺼내봐" 또는 "이거 알면 반은 먹고 들어가" CTA 필수.
예시: "사주 타입별 돈 관리법: 정재형(월급형) → 자동이체. 편재형(사업형) → 현금 묻어두기."`
  },
  {
    id: "humor",
    name: "공감 유머",
    weight: 2,
    instruction: `누구나 공감하는 일상 상황에서 시작해 예상 밖 반전으로 끝내는 유머 포스트.
다음 패턴 중 하나 활용:
  (A) 오라클 반전: "[조언]하라길래 [했는데] → [황당한 현실]" (예: "연락 끊으라길래 끊었는데 내가 더 힘들었다")
  (B) 사주 자조: "사주에 [X]가 없다더니 [관련 현실]도 없다" (예: "사주에 물이 부족하다더니 눈물도 아끼고 있음")
  (C) 기대와 현실 대비: "[기대]라길래 나갔더니 [현실]".
매우 자연스럽고 캐주얼한 친구 말투. 이모지 1-2개 자연스럽게 포함 가능."`
  },
  {
    id: "truth",
    name: "불편한 진실",
    weight: 2,
    instruction: `불편하지만 깊이 공감되는 팩트를 담담하게 말하는 포스트.
모두가 알지만 아무도 입 밖에 내지 않는 것을 직접적으로 언급.
논쟁 유발 필수 — 동의하는 사람과 반론하는 사람 모두 댓글 달게 만들어야 함.
"반박시 니 말이 맞음" 또는 "틀렸으면 댓글 달아" 활용 가능.
핵심 패턴: "[흔한 행동]이 문제가 아니야. [진짜 이유]가 문제인 거야."
예시: "이미 아는 답이 있는데 계속 물어보는 건 몰라서가 아냐. 그 답이 마음에 안 들어서야."`
  },
  {
    id: "snapshot",
    name: "오라클 스냅샷",
    weight: 3,
    instruction: `오라클/운세/사주가 해준 말을 중심으로 한 짧고 강렬한 1인칭 독백 포스트.
구조: "[상황/행동]했는데 → [오라클이 한 말] → [의외의 현실 반응 또는 깨달음]"
오라클의 말은 반드시 직접 인용 형식으로 ("" 사용).
마무리: 본인의 솔직한 반응이나 짧은 깨달음 한 줄로 끝낼 것.
길이: 3-6줄. 짧고 임팩트 있게.
예시: "오라클이 참으라길래 참았는데\n밤 11시에 먼저 연락 온 사람 누구냐"`
  },
  {
    id: "nightmood",
    name: "새벽 감성 독백",
    weight: 2,
    instruction: `새벽/밤에 혼자 드는 생각을 독백형으로 풀어내는 포스트.
논리가 아닌 감정의 흐름을 따라가는 구조. 결론 없어도 됨.
공감 포인트: 새벽에 이성이 아닌 감정이 앞서는 보편적 경험 묘사.
마무리: 짧고 날카로운 한 줄 요약 또는 열린 결말로 끝내기.
길이: 4-8줄. 단문 위주. 행갈이 많이.
절대 금지: 조언, 해결책, CTA, 긍정적 마무리. 그냥 '공감'으로 끝내야 함.
예시: "새벽에 이미 끝난 대화를 다시 열어보는 버릇\n나만 이러나 싶었는데\n아닌 거 알지?"`
  },
];

const TRENDING_HASHTAGS = ["연애고민", "진로고민", "사주", "운세", "타로", "심리", "동기부여", "라이프스타일", "인간관계", "자기계발", "사주팔자", "연애운", "재물운", "직업운", "새벽감성", "공감", "현실공감", "멘탈관리", "감정정리", "오늘의운세"];

// ── 시스템 프롬프트 ────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `너는 ${brandName} 브랜드의 Threads 계정 운영자야.

【브랜드 보이스 — 반드시 준수】
${brandVoice}
${stuntContext}

핵심 규칙:
1. **페르소나**: 브랜드 운영자가 아니라 "운세 좀 보는 아는 친구" 입장에서 써. 광고 느낌 절대 금지.
2. **훅(Hook)은 첫 줄에서 승부**: "니가 믿는 건 틀렸어" 또는 "이거 해당되면 조심해" 식. 뻔한 질문형 시작 금지.
3. **2인칭 직접 말걸기**: "너", "넌", "니" 사용. "여러분" "우리" 금지.
4. **50% 공감 / 50% 각 세우기**: 모두가 좋아하는 글은 아무도 공유 안 해. 동의하는 사람과 반론하는 사람이 동시에 나와야 진짜 바이럴.
5. **길이**: snapshot·nightmood는 3-6줄. 나머지 공식은 6-12줄. 구어체, 단문 위주.
6. **앱/서비스/가격/링크 언급 절대 금지** — 이것만 지켜도 글의 신뢰도 2배.
7. **말미에 리포스트용 한 줄 요약** 배치 (진짜 마음에 박히는 한 문장).
8. **해시태그**: 아래 리스트에서 포스트 주제와 가장 잘 맞는 것 딱 1개만 선택.
   (${TRENDING_HASHTAGS.map(t => `#${t}`).join(", ")})
9. **출력 형식 엄수**:
   [포스트 본문]
   (본문 마지막 줄에 반드시 선택한 해시태그 1개 포함)
   ${SEPARATOR}
   [첫 댓글 내용]
   ${META_SEP}
   formula:{공식id} stunt:{스턴트명 또는 none}`;

// ── 헬퍼 ──────────────────────────────────────────────────────────────────
function buildPool() {
  const pool = [];
  for (const f of FORMULAS) {
    for (let i = 0; i < f.weight; i++) pool.push(f);
  }
  return pool;
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── API 호출 ──────────────────────────────────────────────────────────────
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function verifyOne(post, firstComment) {
    const prompt = `
너는 바이럴 콘텐츠 품질을 심사하는 'Expert Panel'이야.
다음 Threads 포스트와 첫 댓글을 아래 기준에 따라 엄격하게 채점해줘.

【심사 결과 요약 (맨 위에 작성)】
평균 점수: [숫자]
합격 여부: [PASS/FAIL]

【심사 기준 가이드】
${expertPanelGuide}

【심사 대상】
본문:
${post}

첫 댓글:
${firstComment}

【상세 심사 내용】
Roy Lee: (점수)/100
타깃 유저: (점수)/100
편집장: (점수)/100
비평: (어떤 점이 부족하고 어떻게 고쳐야 할지 1문장으로 요약)
`;

    const message = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1000,
        messages: [{ role: "user", content: prompt }],
    });

    const response = message.content[0].text;
    fs.appendFileSync("debug_audit.log", `\n\n--- AUDIT AT ${new Date().toISOString()} ---\n${response}\n`);
    
    // Robust regex to find any number after '평균'
    const scoreMatch = response.match(/(?:평균\s*점수|Average\s*Score)[^0-9]*[:\s]*(\d+)/i);
    const passMatch = response.match(/(?:합격\s*여부|Result|Pass\/Fail)[^A-Z]*[:\s]*(PASS|FAIL)/i);
    const score = scoreMatch ? parseInt(scoreMatch[1], 10) : 0;
    const passed = score >= 85; 
    
    return { score, passed, audit: response };
}

async function generateOne(formula) {
  for (let attempt = 1; attempt <= RETRIES; attempt++) {
    try {
      const message = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 900,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: `[공식: ${formula.name}]\n${formula.instruction}\n\n위 공식으로 Threads 포스트 1개 작성해줘.\n작성 후 ${SEPARATOR}를 출력하고 첫 댓글을 작성해줘.\n그 다음 ${META_SEP}를 출력하고 메타데이터를 작성해줘.`,
          },
        ],
      });

      const raw = message.content[0].text.trim();
      const parts = raw.split(SEPARATOR);
      const post = parts[0].trim();
      const rest = (parts[1] ?? "").split(META_SEP);
      const firstComment = rest[0].trim();
      const meta = (rest[1] ?? "").trim();

      // Expert Panel Verification
      process.stdout.write(` (검증 중…)`);
      const verification = await verifyOne(post, firstComment);
      
      if (!verification.passed && attempt < RETRIES) {
          console.log(` ❌ ${verification.score}점 (미달) → 다시 생성합니다.`);
          continue;
      }

      return { post, firstComment, meta, formulaId: formula.id, score: verification.score, audit: verification.audit };
    } catch (error) {
      const status = error?.status;
      if (RETRYABLE.has(status) && attempt < RETRIES) {
        const wait = BASE_DELAY * attempt;
        console.warn(`  ⚠️  ${status} (시도 ${attempt}/${RETRIES}) → ${wait}ms 후 재시도…`);
        await sleep(wait);
      } else {
        throw error;
      }
    }
  }
}

// ── 메인 ──────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n🚀 ${brandName} 포스트 ${COUNT}개 생성 시작 (배치 ${BATCH}개씩)\n`);
  console.log(`   브랜드 파일: ${BRAND_FILE}`);
  console.log(`   스턴트: ${STUNT ?? "auto"}`);
  console.log(`   출력: ${OUTPUT}\n`);

  const pool = buildPool();
  const results = [];
  const total = Math.ceil(COUNT / BATCH);

  for (let i = 0; i < COUNT; i += BATCH) {
    const batchNum = Math.floor(i / BATCH) + 1;
    const batchSize = Math.min(BATCH, COUNT - i);
    process.stdout.write(`배치 ${batchNum}/${total} (${i + 1}~${i + batchSize}번) 생성 중…`);

    const batch = Array.from({ length: batchSize }, () => generateOne(pickRandom(pool)));
    const texts = await Promise.all(batch);
    results.push(...texts);
    process.stdout.write(` ✅\n`);

    if (i + BATCH < COUNT) await sleep(COOLDOWN);
  }

  // ── 출력 파일 생성 ──────────────────────────────────────────────────────
  const dir = path.dirname(OUTPUT);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const nowStr = new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
  const lines = [
    `# ${brandName} Threads 포스트 초안 (${COUNT}개)`,
    `> 생성일시: ${nowStr}`,
    `> 브랜드: ${brandName} | 스턴트: ${STUNT ?? "auto"}`,
    `> ⚠️ Expert Panel 검증 전 초안입니다. /viral-engine에서 품질 게이트를 통과한 포스트만 발행하세요.`,
    "",
  ];

  results.forEach(({ post, firstComment, meta, score, audit }, index) => {
    lines.push(`---`, ``, `## 포스트 ${index + 1}`, ``);
    lines.push(`> **📊 Expert Score: ${score}/100**`);
    if (score >= 90) lines.push(`> ✅ **품질 게이트 통과 (Roy Lee 승인)**`);
    lines.push(``);
    if (meta) lines.push(`<!-- ${meta} -->`, ``);
    lines.push(post, ``);
    if (firstComment) {
      lines.push(
        `> **💬 첫 댓글 (골든타임용)**`,
        `>`,
        `> ${firstComment.replace(/\n/g, "\n> ")}`,
        ``
      );
    }
    lines.push(`### [품질 리포트]`, `\`\`\``, audit, `\`\`\``, ``);
  });

  fs.writeFileSync(OUTPUT, lines.join("\n"), "utf-8");
  console.log(`\n✨ 초안 ${results.length}개 저장 완료:\n   ${OUTPUT}\n`);
  console.log(`다음 단계: /viral-engine에서 Expert Panel 품질 검증을 실행하세요.\n`);
}

main().catch((error) => {
  console.error("❌ 오류:", error.message ?? error);
  process.exit(1);
});
