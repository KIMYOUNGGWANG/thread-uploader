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

function resolveAgentFile(...subPaths) {
  const p1 = path.resolve(root, ".agents", ...subPaths);
  if (fs.existsSync(p1)) return p1;
  return path.resolve(root, ".agent", ...subPaths);
}

const EXPERT_PANEL_REF = resolveAgentFile("skills/threads-engine/references/expert-panel.md");
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

const defaultBrandFile = resolveAgentFile("memory/brand-voice.md");
const BRAND_FILE = path.resolve(root, args["--brand"] ?? defaultBrandFile);
const COUNT = parseInt(args["--count"] ?? "60", 10);
const rawStunt = args["--stunt"] ?? null;

const STUNT_PRESETS = {
  career_mismatch: `기질-조직 미스매치 팩폭 (Career Mismatch):
너의 번아웃은 성격 결함이나 의지 부족이 아니라, 창작욕/실행력(식상 80%)과 5단계 위계 조직(관성)의 수학적 미스매치임을 폭로하여 자책감을 깨고 현실 행동선을 제시.`,
  energy_reset_cycle: `10년 대운 교운기 번아웃 (Energy Reset Cycle):
멀쩡히 살다가 갑자기 출근길에 눈물 나고 무기력한 건 단순 슬럼프가 아니라 10년 대운이 교체되는 판 리셋 주기임을 짚어 홧김 퇴사 손실을 막음.`,
  common_enemy: `공공의 적 선언 (Common Enemy Manifesto):
"위로가 필요하면 정신과나 상담실을 가라. 여기는 당신이 실수하지 않도록 리스크를 헷징하는 인텔리전스 룸이다"라는 단호한 선언으로 가짜 위로를 파는 양산형 운세 배제.`,
};

const STUNT = rawStunt ? (STUNT_PRESETS[rawStunt] ?? rawStunt) : null;
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
  ? `\n【이번 배치 스턴트 전략】\n${STUNT}\n위 스턴트의 구조와 원칙을 자연스럽게 반영해.`
  : "";

// ── 상수 ──────────────────────────────────────────────────────────────────
const SEPARATOR = "===FIRST_COMMENT===";
const META_SEP = "===META===";
const BATCH = 2;
const COOLDOWN = 800;
const RETRIES = 5;
const BASE_DELAY = 3000;
const RETRYABLE = new Set([429, 529]);

const ROTATING_TOPICS = [
  "이직/퇴사 타이밍 (지금 존버할 때 vs 판 엎고 탈출할 골든타임)",
  "재물운과 통장 잔고 (내 타고난 돈 창고와 매달 돈 새어나가는 구멍)",
  "인간관계와 상극 손절선 (만나면 속 갉아먹는 관계 손절 타이밍)",
  "현실 진로와 재능 판정 (공부 머리 vs 일 머리, 조직 적응력 판정)",
  "연애와 궁합 (끌리는데 이상하게 망하는 연애 vs 귀인 만난 궁합)",
  "대운 전환 신호 (인생 판 뒤집히기 직전 나타나는 3대 신체적/상황적 징조)",
  "번아웃과 에너지 불균형 (월급은 올랐는데 영혼이 썩어가는 이유)",
  "커리어 결정장애 딜레마 (이직 제안 vs 현 직장 잔류 vs 창업 갈림길)",
];

// ── 포스트 공식 ────────────────────────────────────────────────────────────
const FORMULAS = [
  {
    id: "sal_hierarchy_ego",
    name: "살 서열화 & 에고 스트로킹 (12만 뷰 검증)",
    weight: 8,
    instruction: `도화/홍염/화개, 백호/괴강 등 기운의 치명적 서열을 비교하고 독자의 잠재력을 자극하는 압축형(140~200자) 포스트.
구조:
- 오프닝: "혹시 [A]보다 센 [B]보다 센 게 뭔지 알아? 바로 [C]야." 절대 서열 제시 (40자 이내)
- 본문: [C]가 왜 치명적인지 극단적 1줄 앵커 묘사 (예: "스님도 파계시킴")
- 투사: "너한테 그런 치명적 매력/천재성이 숨겨져 있을 수도."
- 마무리: 본문 링크 절대 금지, 첫 댓글에 "이게 매력으로 터질지 파탄으로 터질지는 지지 1개 차이" 결핍 브릿지 유도.`
  },
  {
    id: "lotto_zero_friction",
    name: "초저마찰 3지선다 딜레마 (30만 뷰 검증)",
    weight: 6,
    instruction: `극단적 상황이나 상상을 제시하고 1초 만에 1/2/3 번호를 댓글로 달게 만드는 초저마찰 참여 포스트.
구조:
- 오프닝: 즉각적인 일상 딜레마 상황 제시 ("퇴근길 10억 받기 vs 야근 없는 워라밸" 등)
- 본문: 1초 만에 고를 수 있는 3가지 번호 선택지 (1. 즉각행동, 2. 현실대안, 3. 의외의 반전/시니컬)
- 주의: "자, 상상해봐" 같은 식상한 문구 금지. 구구절절한 설명 없이 선택지만 명확히 던져 댓글 폭발 유도.`
  },
  {
    id: "career_mismatch",
    name: "기질-조직 미스매치 팩폭 (실전 웻지)",
    weight: 6,
    instruction: `2030 직장인의 번아웃과 이직 충동이 개인의 나태함이 아니라 기질과 조직 구조의 수학적 미스매치임을 입증.
구조:
- 오프닝: "네가 이직 1년 만에 번아웃 온 건 노력이 부족해서가 아니야." (40자 이내)
- 본문: 실행력(식상) 80%인데 결재만 5단계인 위계 조직에 들어간 기질-조직 불일치 팩폭.
- 마무리: 포지션을 바꾸지 않고 회사만 옮기면 똑같이 반복된다는 현실 판정.`
  },
  {
    id: "energy_reset_cycle",
    name: "10년 대운 리셋 신호 (실전 웻지)",
    weight: 5,
    instruction: `원인 모를 무기력증과 퇴사 충동을 단순 슬럼프가 아닌 10년 대운 교체기(교운기)로 진단.
구조:
- 오프닝: "갑자기 출근길에 모든 의욕이 0이 됐다면 슬럼프가 아니라 판이 리셋되는 신호임."
- 본문: 교운기 1~2년엔 홧김 퇴사/충동 창업하면 100% 물린다는 현실 리스크 팩트 제시.
- 마무리: 지금은 새 패를 쥐기보다 멘탈과 통장 잔고를 헷징할 타이밍임을 강조.`
  },
  {
    id: "warning",
    name: "경고/위험 회피",
    weight: 4,
    instruction: `특정 타깃이 반드시 조심해야 할 것을 경고하는 포스트.
훅: "[타깃]이 반드시 조심해야 할 [N]가지" 또는 "[타깃]라면 [위험] 지금 당장 확인해" 형식.
리스트(1. 2. 3.) 또는 단락형으로 위험 신호 2-3개 나열. (140~200자 압축)
각 항목은 구체적인 상황/행동 묘사 포함 — 추상적 경고 금지.
반드시 마지막 줄에 CTA 삽입: "해당되면 저장해" 또는 "주변에 [타깃] 있으면 공유해줘".
톤: 공포 유발이 아니라 "알고 대비하면 막을 수 있어" 따뜻한 경고. 나쁜 결과보다 좋아지는 방향 강조.`
  },
  {
    id: "contrarian",
    name: "반직관 훅",
    weight: 3,
    instruction: `모두가 당연하게 믿는 상식을 정면으로 반박.
구조: "[상식] = [오해]? (X) → 진짜는 [반전] (O)" 패턴을 기본으로 사용.
반박 근거 2-3개 제시. 의도적으로 반박 여지를 남겨서 댓글 유발.
주의: "반박시 니 말이 맞음" 같은 상투적 클리셰 절대 금지. 날카로운 팩트로 끝낼 것.
사주/의사결정/타이밍 관련 흔한 오해를 정면으로 뒤집는 것이 특히 효과적.`
  },
  {
    id: "choice",
    name: "편가르기",
    weight: 3,
    instruction: `극적인 상황을 설정하고 반드시 딱 3개의 선택지를 줘. (4개 이상 금지)
1번과 2번은 예측 가능한 답. 3번은 반드시 반전/의외/웃긴 답이어야 함.
질문으로 끝내지 말 것 — 선택지만 던지면 독자가 자연히 댓글로 반응함.
도입부는 매번 완전히 다른 구조로 작성. ("자, 상상해봐" 표현 절대 금지)
오프닝 예시: 상황 묘사, 팩트 폭격, 질문 없는 딜레마 설정 등 다양하게.`
  },
  {
    id: "reveal",
    name: "반전 폭로",
    weight: 3,
    instruction: `"A인 줄 알았는데 → 사실은 B, 근데 진짜는 C" 단계적 반전 구조.
독자가 당연하게 생각하는 결론을 1단계 뒤집고, 다시 2단계 뒤집어 진짜 핵심 도달.
매번 전혀 다른 문장 구조로 시작할 것.
마무리: "너도 혹시 이거 해당되는지 확인해봐" 또는 "알고 있었어?" 형식으로 독자 확인 유도.`
  },
  {
    id: "truth",
    name: "불편한 진실",
    weight: 2,
    instruction: `불편하지만 깊이 공감되는 팩트를 담담하게 말하는 포스트.
모두가 알지만 아무도 입 밖에 내지 않는 것을 직접적으로 언급.
논쟁 유발 필수 — 동의하는 사람과 반론하는 사람 모두 댓글 달게 만들어야 함.
주의: "반박시 니 말이 맞음" 같은 상투적 밈 금지. 팩트 중심으로 찌를 것.
핵심 패턴: "[흔한 행동]이 문제가 아니야. [진짜 이유]가 문제인 거야."`
  },
];

const TRENDING_HASHTAGS = ["이직고민", "진로고민", "사주", "번아웃", "이직타이밍", "자미두수", "의사결정", "심리", "동기부여", "라이프스타일", "인간관계", "자기계발", "사주팔자", "연애운", "재물운", "직업운", "새벽감성", "공감", "현실공감", "멘탈관리", "감정정리", "오늘의운세"];

// ── 시스템 프롬프트 ────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `너는 ${brandName} 브랜드의 Threads 계정 운영자야.

【브랜드 보이스 — 반드시 준수】
${brandVoice}
${stuntContext}

핵심 규칙:
1. **페르소나**: 브랜드 운영자가 아니라 "운세 좀 보는 아는 친구" 입장에서 써. 광고 느낌 절대 금지.
2. **훅(Hook)은 첫 줄에서 승부**: "니가 믿는 건 틀렸어" 또는 "A보다 센 B보다 센 게 뭔지 알아? 바로 C야" 식. 뻔한 질문형 시작 금지.
3. **2인칭 직접 말걸기**: "너", "넌", "니" 사용. "여러분" "우리" 금지.
4. **50% 공감 / 50% 각 세우기**: 모두가 좋아하는 글은 아무도 공유 안 해. 동의하는 사람과 반론하는 사람이 동시에 나와야 진짜 바이럴.
5. **길이**: **140~220자 내외(모바일 폴드 상단 승부)**. 모바일 화면에서 '...더 보기' 접힘 없이 한눈에 들어오는 단문 구어체. 장황한 배경 설명이나 긴 체크리스트 나열 절대 금지.
6. **앱/서비스/가격/링크 언급 본문 절대 금지** — 본문에는 외부 링크나 광고 단어 일체 금지.
7. **첫 댓글 대화 점화(Conversation Igniter)**: [절대 금지: 링크/프로필/리포트/세일즈 언급 일체 금지] 첫 댓글은 본인의 솔직한 실패담이나 유저들이 댓글을 달게 만드는 날것의 딜레마 한 줄로만 작성 (예: "솔직히 나도 2번 골랐다가 1년 번아웃 와서 퇴직금 다 털렸음 ㅋㅋㅋ 너넨 몇 번이냐?"). 절대 프로필 링크나 리포트 판정표를 언급하지 마라.
8. **AI 클리셰 슬롭 및 메타 텍스트 전면 금지**: 제목(# 제목), '생성 완료', '자수 체크', '포맷 체크' 등 기획서용 메타 텍스트 및 "반박시 니 말이 맞음", "끝. 더 이상 설명 안 함" 등 상투적 밈 절대 금지. 순수 텍스트만 출력.
9. **말미에 리포스트용 한 줄 요약** 배치 (진짜 마음에 박히는 한 문장).
10. **해시태그**: 아래 리스트에서 포스트 주제와 가장 잘 맞는 것 딱 1개만 선택.
   (${TRENDING_HASHTAGS.map(t => `#${t}`).join(", ")})
11. **출력 형식 엄수**:
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

async function generateOne(formula, topic, recentOpenings = []) {
  for (let attempt = 1; attempt <= RETRIES; attempt++) {
    try {
      const antiRepeatInstruction = recentOpenings.length > 0
        ? `\n[최근 생성된 첫 문장들 - 절대 유사하게 시작하거나 중복 소재를 쓰지 마라]:\n${recentOpenings.slice(-6).map((o, idx) => `${idx + 1}. "${o}"`).join("\n")}\n`
        : "";

      const message = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 900,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: `[필수 주제]: ${topic}
[공식: ${formula.name}]
${formula.instruction}
${antiRepeatInstruction}
위 필수 주제와 공식의 원칙을 결합하여 Threads 포스트 1개를 작성해줘.
1961년 동경시, 진태양시, 32분 오차, 바넘 효과 등 유효기간 지난 레거시 어그로는 절대 금지한다.
글자 수나 공식 이름 같은 메타 라벨 없이 본문 첫 문장부터 즉각 시작해라.
작성 후 ${SEPARATOR}를 출력하고 첫 댓글을 작성해줘.
그 다음 ${META_SEP}를 출력하고 메타데이터를 작성해줘.`,
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
  const recentOpenings = [];
  const total = Math.ceil(COUNT / BATCH);

  for (let i = 0; i < COUNT; i += BATCH) {
    const batchNum = Math.floor(i / BATCH) + 1;
    const batchSize = Math.min(BATCH, COUNT - i);
    process.stdout.write(`배치 ${batchNum}/${total} (${i + 1}~${i + batchSize}번) 생성 중…`);

    const batch = Array.from({ length: batchSize }, (_, j) => {
      const postIndex = i + j;
      const topic = ROTATING_TOPICS[postIndex % ROTATING_TOPICS.length];
      const formula = pickRandom(pool);
      return generateOne(formula, topic, recentOpenings);
    });
    const texts = await Promise.all(batch);
    for (const t of texts) {
      if (t?.post) {
        const firstLine = t.post.split("\n")[0].trim();
        if (firstLine) recentOpenings.push(firstLine);
      }
    }
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
