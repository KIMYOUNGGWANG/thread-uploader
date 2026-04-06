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

// ── 시스템 프롬프트 ────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `너는 ${brandName} 브랜드의 Threads 계정 운영자야.

【브랜드 보이스 — 반드시 준수】
${brandVoice}
${stuntContext}

핵심 규칙:
1. 2인칭으로 직접 말걸기 ("너", "넌", "니")
2. 해시태그 정확히 1개만
3. 길이: 6-12줄
4. 글 말미에 리포스트 유발용 강한 한 줄 요약 배치
5. 브랜드 광고/홍보 느낌 금지 — 친구가 말해주는 톤
6. 앱/서비스 이름이나 링크 포함 금지
7. 출력 형식 엄수:
   포스트 본문 작성
   ${SEPARATOR}
   게시 직후 달 첫 댓글 (2-3문장, 반말, 본문 보완)
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

      return { post, firstComment, meta, formulaId: formula.id };
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

  results.forEach(({ post, firstComment, meta }, index) => {
    lines.push(`---`, ``, `## 포스트 ${index + 1}`, ``);
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
  });

  fs.writeFileSync(OUTPUT, lines.join("\n"), "utf-8");
  console.log(`\n✨ 초안 ${results.length}개 저장 완료:\n   ${OUTPUT}\n`);
  console.log(`다음 단계: /viral-engine에서 Expert Panel 품질 검증을 실행하세요.\n`);
}

main().catch((error) => {
  console.error("❌ 오류:", error.message ?? error);
  process.exit(1);
});
