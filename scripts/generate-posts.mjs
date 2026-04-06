/**
 * generate-posts.mjs
 * 사용법: node scripts/generate-posts.mjs [count] [output.md]
 * 예:     node scripts/generate-posts.mjs 50 output/posts.md
 */

import Anthropic from "@anthropic-ai/sdk";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// ── env 로드 (.env.local → .env 순으로 시도) ─────────────────────────────
const __dirname = path.dirname(fileURLToPath(import.meta.url));
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
    console.log(`✅ env loaded: ${envFile}`);
    break;
  }
}

if (!process.env.ANTHROPIC_API_KEY) {
  console.error("❌ ANTHROPIC_API_KEY가 없습니다. .env.local을 확인하세요.");
  process.exit(1);
}

// ── 설정 ─────────────────────────────────────────────────────────────────
const COUNT = parseInt(process.argv[2] ?? "30", 10);
const OUTPUT = path.resolve(process.argv[3] ?? path.join(root, "output", `posts-${Date.now()}.md`));
const BATCH = 2;           // 동시 요청 수 (보수적)
const COOLDOWN = 800;      // 배치 사이 간격 (ms)
const RETRIES = 5;
const BASE_DELAY = 3000;   // 재시도 기본 딜레이 (ms)
const SEPARATOR = "===FIRST_COMMENT===";

const RETRYABLE = new Set([429, 529]);

// ── 포뮬러 & 토픽 ─────────────────────────────────────────────────────────
const FORMULAS = [
  {
    id: "warning", name: "경고/위험 회피", weight: 4,
    instruction: `사주/점성술 관점에서 특정 띠·별자리·일주가 반드시 조심해야 할 것을 경고하는 포스트.
제목 라인은 반드시 이런 형식 중 하나로 시작해:
  - "[연도] [띠/별자리]가 반드시 조심해야 할 [N]가지"
  - "올해 이 [띠/별자리]는 [운 분야] 최악입니다"
  - "[글자/별자리] 있으면 [연도] [위험한 상황] 주의"
  - "[운 분야]이 무너지는 [띠/일주] 특징"
경고 내용은 건강·돈·연애·직장 중 하나를 구체적으로 지정.
리스트 형식(1. 2. 3.)으로 위험 신호를 나열해.
마지막에 "해당되면 저장해" 또는 "주변에 이 띠 있으면 공유해줘" 형태 CTA.
공포를 주는 게 아니라, 알고 대비하면 막을 수 있다는 느낌으로.`,
  },
  {
    id: "contrarian", name: "반직관 훅", weight: 3,
    instruction: `모두가 당연하게 믿는 사주/점성술 상식을 정면으로 반박.
"사실 [당연한 상식]은 틀렸어" 또는 "아무도 말 안 해주는 진짜 얘기" 형식.
반박할 여지를 의도적으로 남겨서 동의파/반론파 모두 댓글 달게.
"반박시 니 말이 맞음" 또는 "틀리면 댓글로 논쟁 걸어" 가능.`,
  },
  {
    id: "choice", name: "편가르기", weight: 3,
    instruction: `극적인 상황을 설정하고 3개의 선택지를 줘.
3번은 반전이거나 의외의 답.
사주/점성술 개념을 자연스럽게 연결 (선택사항).
질문으로 끝내지 말 것. (선택지만 주면 됨)
도입부를 매번 완전히 다른 구조로 창의적으로 작성해. ("자, 상상해봐" 반복 금지)`,
  },
  {
    id: "reveal", name: "반전 폭로", weight: 3,
    instruction: `사주/점성술 개념을 반전 구조로 소개.
A보다 B가 낫고, B보다 C가 더 강력하다는 식의 논리 전개.
매번 전혀 다른 문장 구조로 시작할 것. ("혹시 ~보다 센 게 뭔지 알아?" 반복 금지)
설명 후 독자도 해당되는지 확인 유도.`,
  },
  {
    id: "thisorthat", name: "양자택일", weight: 2,
    instruction: `사주/점성술 개념으로 극단적으로 다른 두 유형 대비.
에너지나 성향 차이를 나열하고 마지막에 선택을 유도해볼 것.
도입부를 매 포스트마다 다른 일상적 상황이나 다른 말투로 시작해. 똑같은 패턴 금지.
댓글 달기 쉽게 진입장벽 낮추기.`,
  },
  {
    id: "check", name: "해당여부 확인", weight: 2,
    instruction: `특정 사주 글자나 별자리 조합을 나열.
"깔려있어?" "있어?"로 독자가 본인 해당 여부 확인하게.
"축하해. 넌 [특별한 것]이야" 또는 "조심해야 해" 구조.`,
  },
  {
    id: "save", name: "저장형 정리", weight: 2,
    instruction: `체크리스트·단계별 방법론·비교표 형식.
"저장해두고 나중에 꺼내봐" CTA 직접 작성.
앱 없어도 이해되는 독립형 콘텐츠.
수치·공식화된 팁 위주. 3~5줄 리스트로 정리.`,
  },
  {
    id: "humor", name: "공감 유머", weight: 2,
    instruction: `공통 경험 (점집, MBTI, 별자리 앱 등)에서 시작.
"그 돈/시간으로 더 나은 걸 했을걸" 반전.
매우 자연스럽고 캐주얼한 친구 말투 유지.`,
  },
  {
    id: "truth", name: "불편한 진실", weight: 2,
    instruction: `사주 관점의 불편하지만 공감 가는 팩트.
논쟁 유발 - 동의하는 사람과 반론하는 사람 모두 댓글 달게.
직설적이고 솔직한 톤. "반박시 니 말이 맞음" 같은 표현 가능.`,
  },
];

const TOPICS = [
  // 경고/위험 회피 전용 토픽
  "2026년 병오년 - 조심해야 할 띠", "올해 건강운 최악인 별자리", "재물운 무너지는 일주",
  "2026년 연애운 최악인 띠 조합", "올해 이직하면 망하는 사주", "직장운 흔들리는 글자",
  "올해 사고수 있는 띠", "2026년 반드시 건강검진 받아야 할 별자리", "올해 돈 나갈 구멍 많은 일주",
  // 기존 토픽
  "화개살 (스님도 파계시키는 매력)", "도화살 (인기 있어 보이지만 똥파리 꼬이는 체질)",
  "홍염살 (도화보다 강한 끌림)", "역마살 (가만 못 있는 운명)", "원진살 (끌리는데 안 맞는 사람)",
  "귀문관살 (예민하고 감각 날카로운 체질)", "편인(偏印) - 공부머리 vs 식신 일머리",
  "식신(食神) - 먹복과 표현력", "재성(財星) - 돈 그릇 크기", "관성(官星) - 직장/명예운",
  "상관(傷官) - 반골 기질", "비견/겁재 - 경쟁심과 독립심", "돈창고 삼합 (진술축미)",
  "화의 삼합 (인오술) - 불같은 에너지", "천을귀인 - 귀인 끌어들이는 글자",
  "문창귀인 - 공부/글재주 운", "이직/전직하기 좋은 대운 타이밍", "재물운 터지는 시기 보는 법",
  "연애/궁합 - 사주로 보는 이상형", "인연복 있는 사주", "올해 대운 어떻게 흘러가나",
  "쌍둥이자리 + 사주 교차 분석", "전갈자리 + 사주 교차 분석", "MBTI가 못 잡는 걸 사주가 잡는 이유",
  "갑자일주 - 자존심과 재능", "무진일주 - 돈 잘 버는 체질", "경오일주 - 카리스마",
  "임술일주 - 고집과 매력", "별자리로 못 보는 걸 사주로 보기", "타고난 직업적성 사주로 보기",
];

// ── 2026 병오년 사주 지식 베이스 ─────────────────────────────────────────
const SAJU_2026 = `
【2026년 병오년(丙午) 핵심 사주 지식 — 경고형 포스트 작성 시 반드시 이 원리에 근거할 것】

▶ 병오년 기본 특성
- 천간 병(丙) = 하늘의 태양. 양화(陽火)로 강렬하고 직접적인 불 기운.
- 지지 오(午) = 말띠. 오화(午火)도 불. → 화(火) 기운이 하늘·땅 모두 불. 극도로 강한 불의 해.
- 화(火) 과잉 → 수(水) 기운 고갈 → 신장·혈액·심혈관·눈 계열 전반 약화.
- 조급함·충동·과욕 에너지가 강한 해. 빠른 판단 금물.

▶ 충(沖) — 정면 충돌하는 띠 [가장 강한 위험 신호]
- 자(子)띠 (쥐띠, 1948·1960·1972·1984·1996·2008·2020년생)
  → 자오충(子午沖). 이동수·변동수·사고수 최강. 교통사고, 이직 충동 주의.
  → 수(水) 기운 자인 자(子)가 오화(午火)에 직격 → 건강: 신장·방광·생식기 주의.

▶ 형(刑) — 소리 없이 갉아먹는 관계
- 묘(卯)띠 (토끼띠, 1951·1963·1975·1987·1999·2011·2023년생)
  → 오묘 자형(自刑). 자기 스스로를 무너뜨리는 에너지. 자책·자기파괴·중독 주의.
  → 건강: 간담·근육·스트레스성 질환. 정신 건강 특히 주의.

▶ 합(合) — 에너지 묶임, 좋지만 조심
- 인(寅)띠 (호랑이띠, 1950·1962·1974·1986·1998·2010·2022년생)
  → 인오술 화국(火局) 삼합. 불이 더욱 강하게 타오름. 화(火) 과잉 체질은 폭발 위험.
  → 충동적 투자, 계약 서두름 주의. 이미 화 기운 많은 사람은 소진 극심.
- 술(戌)띠 (개띠, 1946·1958·1970·1982·1994·2006·2018년생)
  → 인오술 삼합 동일. 재물 욕심이 과해져서 무리한 사업 확장 주의.

▶ 원진(怨嗔) — 겉으론 괜찮아 보이지만 속으로 갈등
- 미(未)띠 (양띠, 1955·1967·1979·1991·2003·2015년생)
  → 오미 원진. 연애·대인관계에서 말 못 할 갈등 누적. 이별·단절 주의.

▶ 오행별 건강 경고 (병오년 화 과잉 기준)
- 금(金) 일간 (경庚·신辛일주): 화극금(火克金) → 폐·대장·피부 약화. 재물·직장 압박.
- 수(水) 일간 (임壬·계癸일주): 화(火)에 수(水) 고갈 → 신장·방광·체력 저하. 과로 금물.
- 목(木) 일간 (갑甲·을乙일주): 목생화(木生火)로 에너지 소진 심함. 번아웃 주의.
- 화(火) 일간 (병丙·정丁일주): 비겁 과잉 → 경쟁, 감정 기복, 충동 소비 주의.
- 토(土) 일간 (무戊·기己일주): 화생토(火生土)로 표면적으론 괜찮지만 과욕 경계.

▶ 주요 지지별 추가 경고
- 오(午)일주: 복음(伏吟). 같은 글자 겹침 → 정체, 심리적 소진, 건강 방전.
- 자(子)일주: 충(沖) 직격 → 전직, 이사, 사고 모두 주의. 지출 급증 가능.
- 묘(卯)일주: 형(刑) 자충살 → 멘탈 관리 최우선. 술·도박·중독성 취미 주의.

▶ 연애·관계 경고
- 자오충 일주·띠: 기존 연인과 갑작스러운 이별, 또는 충동적 만남 후 후회.
- 오미 원진 조합 커플: 2026년 잠재적 갈등 폭발 구간. 말하기 전에 한 번 더 생각.
- 화 과잉 해: 감정 기복·충동 고백·이별 통보 모두 충동적으로 처리하다 후회.

▶ 재물·직장 경고
- 화(火)가 강한 해 = 욕망 과열 → 코인·주식·사업 무리 확장 1순위 주의 연도.
- 금(金) 일간 특히: 수입 불안정, 상사와 마찰, 직장 내 충돌 가능성.
- 자(子)·묘(卯)띠: 이직 충동 → 현재 자리 유지가 유리한 해.

⚠️ 경고형 포스트 작성 원칙:
1. 위 원리에서 근거를 찾아 작성. 근거 없는 주장 금지.
2. "무조건 나쁘다"가 아니라 "이 점을 조심하면 막을 수 있어" 톤 유지.
3. 독자가 본인 띠·일주를 확인하고 싶게 만들 것.
`;

const SYSTEM_PROMPT = `너는 CosmicPath(AI 사주+점성술+타로 앱) Threads 계정 운영자야.
실제로 29만 조회, 9만 조회 받은 포스트들의 톤과 구조를 완벽히 이해하고 있어.

${SAJU_2026}

핵심 규칙:
1. 반드시 2인칭 ("너", "넌", "니")으로 직접 말걸기
2. 해시태그는 정확히 1개만. #코스믹패스 #운세앱 #AI오라클 절대 금지. 태그 2개 이상 금지
3. "댓글로 남겨줘" "봐줄게" 같이 내가 답장해야 하는 구조 금지
4. 브랜드 광고/홍보 느낌 일절 금지 - 친구가 말해주는 톤
5. 앱 이름(CosmicPath)이나 링크를 포함하지 말 것
6. 길이: 6-12줄
7. 글 말미에 리포스트 유발용 강한 한 줄 요약 문장을 배치 (인용하기 쉬운 형식)
8. 출력 형식 엄수:
   - 먼저 포스트 텍스트 작성
   - 그 다음 줄에 정확히 이것만 출력: ===FIRST_COMMENT===
   - 그 아래에 게시 직후 내가 달 첫 댓글 작성 (본문 보완 인사이트 또는 팔로워 참여 유도 질문, 2~3문장, 반말 유지)
   - 설명·제목·번호 절대 금지`;

// ── 헬퍼 ─────────────────────────────────────────────────────────────────
function buildPool() {
  const pool = [];
  for (const f of FORMULAS) for (let i = 0; i < f.weight; i++) pool.push(f);
  return pool;
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function shuffleTopics(n) {
  const shuffled = [...TOPICS].sort(() => Math.random() - 0.5);
  const result = [];
  while (result.length < n) result.push(...shuffled.slice(0, Math.min(TOPICS.length, n - result.length)));
  return result;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ── API 호출 ──────────────────────────────────────────────────────────────
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function generateOne(formula, topic) {
  for (let attempt = 1; attempt <= RETRIES; attempt++) {
    try {
      const msg = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 900,
        system: SYSTEM_PROMPT,
        messages: [{
          role: "user",
          content: `[공식: ${formula.name}]\n${formula.instruction}\n\n[주제]\n${topic}\n\n위 공식과 주제로 Threads 포스트 1개 작성해줘.\n작성 후 ${SEPARATOR} 를 출력하고, 바로 아래에 게시 직후 달 첫 댓글을 작성해줘.`,
        }],
      });
      const raw = msg.content[0].text.trim();
      const parts = raw.split(SEPARATOR);
      const post = parts[0].trim();
      const firstComment = (parts[1] ?? "").trim();
      return { post, firstComment };
    } catch (err) {
      const status = err?.status;
      if (RETRYABLE.has(status) && attempt < RETRIES) {
        const wait = BASE_DELAY * attempt;
        console.warn(`  ⚠️  ${status} (시도 ${attempt}/${RETRIES}) → ${wait}ms 후 재시도…`);
        await sleep(wait);
      } else {
        throw err;
      }
    }
  }
}

// ── 메인 ─────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n🚀 포스트 ${COUNT}개 생성 시작 (배치 ${BATCH}개씩)\n`);

  const pool = buildPool();
  const topics = shuffleTopics(COUNT);
  const results = [];
  const total = Math.ceil(COUNT / BATCH);

  for (let i = 0; i < COUNT; i += BATCH) {
    const batchNum = Math.floor(i / BATCH) + 1;
    const batchSize = Math.min(BATCH, COUNT - i);
    process.stdout.write(`배치 ${batchNum}/${total} (${i + 1}~${i + batchSize}번) 생성 중…`);

    const batch = Array.from({ length: batchSize }, (_, j) =>
      generateOne(pickRandom(pool), topics[i + j])
    );
    const texts = await Promise.all(batch);
    results.push(...texts);
    process.stdout.write(` ✅\n`);

    if (i + BATCH < COUNT) await sleep(COOLDOWN);
  }

  // ── MD 파일로 저장 ──────────────────────────────────────────────────
  const dir = path.dirname(OUTPUT);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const now = new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
  const lines = [
    `# CosmicPath Threads 포스트 (${COUNT}개)`,
    `> 생성일시: ${now}`,
    "",
  ];

  results.forEach(({ post, firstComment }, i) => {
    lines.push(`---`, ``, `## 포스트 ${i + 1}`, ``, post, ``);
    if (firstComment) {
      lines.push(`> **💬 첫 댓글 (골든타임용)**`, `>`, `> ${firstComment.replace(/\n/g, "\n> ")}`, ``);
    }
  });

  fs.writeFileSync(OUTPUT, lines.join("\n"), "utf-8");
  console.log(`\n✨ 완료! ${results.length}개 저장됨:\n   ${OUTPUT}\n`);
}

main().catch((err) => {
  console.error("❌ 오류:", err.message ?? err);
  process.exit(1);
});
