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
제목 라인: "[타깃]가 반드시 조심해야 할 [N]가지" 또는 "[타깃]는 [위험] 주의" 형식.
리스트 형식(1. 2. 3.)으로 위험 신호 나열.
마지막 CTA: "해당되면 저장해" 또는 "주변에 [타깃] 있으면 공유해줘".
톤: 공포 유발이 아니라 "알고 대비하면 막을 수 있어" 느낌.`,
  },
  {
    id: "contrarian",
    name: "반직관 훅",
    weight: 3,
    instruction: `모두가 당연하게 믿는 상식을 정면으로 반박.
"사실 [당연한 상식]은 틀렸어" 또는 "아무도 말 안 해주는 진짜 얘기" 형식.
반박 근거 2-3개 제시. 반박할 여지를 의도적으로 남겨서 댓글 유발.
"반박시 니 말이 맞음" 표현 가능.`,
  },
  {
    id: "choice",
    name: "편가르기",
    weight: 3,
    instruction: `극적인 상황을 설정하고 3개의 선택지를 줘.
3번은 반전이거나 의외의 답. 질문으로 끝내지 말 것 — 선택지만 주면 됨.
도입부를 매번 완전히 다른 구조로 창의적으로 작성해. ("자, 상상해봐" 반복 금지)`,
  },
  {
    id: "reveal",
    name: "반전 폭로",
    weight: 3,
    instruction: `A보다 B가 낫고, B보다 C가 더 강력하다는 식의 논리 전개.
매번 전혀 다른 문장 구조로 시작할 것. 설명 후 독자도 해당되는지 확인 유도.`,
  },
  {
    id: "thisorthat",
    name: "양자택일",
    weight: 2,
    instruction: `극단적으로 다른 두 유형 대비. 에너지나 성향 차이를 나열하고 마지막에 선택 유도.
도입부를 매 포스트마다 다른 일상적 상황이나 다른 말투로 시작해.`,
  },
  {
    id: "check",
    name: "해당여부 확인",
    weight: 2,
    instruction: `특정 조건을 나열. "있어?" "깔려있어?" 형식으로 독자 확인.
"있으면 넌 [특별한 것]이야" 또는 "조심해야 해" 구조.`,
  },
  {
    id: "save",
    name: "저장형 정리",
    weight: 2,
    instruction: `체크리스트·단계별 방법론·비교표 형식.
"저장해두고 나중에 꺼내봐" CTA 직접 작성.
앱 없어도 이해되는 독립형 콘텐츠. 수치/공식화된 팁 위주. 3-5줄 리스트.`,
  },
  {
    id: "humor",
    name: "공감 유머",
    weight: 2,
    instruction: `공통 경험에서 시작. "그 시간/돈으로 더 나은 걸 했을걸" 반전 포함.
매우 자연스럽고 캐주얼한 친구 말투 유지.`,
  },
  {
    id: "truth",
    name: "불편한 진실",
    weight: 2,
    instruction: `불편하지만 공감 가는 팩트. 논쟁 유발 — 동의하는 사람과 반론하는 사람 모두 댓글 달게.
직설적이고 솔직한 톤. "반박시 니 말이 맞음" 가능.`,
  },
];

const TRENDING_HASHTAGS = ["연애고민", "진로고민", "사주", "운세", "타로", "심리", "동기부여", "라이프스타일", "인간관계", "자기계발"];

// ── 시스템 프롬프트 ────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `너는 ${brandName} 브랜드의 Threads 계정 운영자야.

【브랜드 보이스 — 반드시 준수】
${brandVoice}
${stuntContext}

핵심 규칙 (Roy Lee 스타일):
1. **훅(Hook)은 뺨을 때리듯 시작해**: "너 이거 몰랐지?" 수준이 아니라 "니가 믿는 건 틀렸어" 또는 "이거 안 하면 망해" 식의 극단적 훅. (예: "10만원 버리기 싫으면 이 글 읽지 마")
2. 2인칭으로 직접 말걸기 ("너", "넌", "니")
3. 해시태그 규칙: 아래 리스트에서 딱 1개 선택 (${TRENDING_HASHTAGS.map(t => `#${t}`).join(", ")})
4. **50% 혐오 테스트**: 모두가 좋아하는 글은 아무도 공유 안 해. 반이 싫어하고 반이 미치도록 좋아하는 '각'을 세워.
5. 길이: 6-12줄, 구어체 (친구와 술자리 대화 톤)
6. 앱/서비스/링크 언급 절대 금지
7. 말미에 강한 한 줄 요약 배치 (리포스트용)
7. 출력 형식 엄수:
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
