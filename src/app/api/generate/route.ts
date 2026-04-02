import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const FORMULAS = [
  {
    id: "contrarian",
    name: "반직관 훅",
    weight: 3,
    instruction: `모두가 당연하게 믿는 사주/점성술 상식을 정면으로 반박.
"사실 [당연한 상식]은 틀렸어" 또는 "아무도 말 안 해주는 진짜 얘기" 형식.
반박할 여지를 의도적으로 남겨서 동의파/반론파 모두 댓글 달게.
"반박시 니 말이 맞음" 또는 "틀리면 댓글로 논쟁 걸어" 가능.`,
  },
  {
    id: "choice",
    name: "편가르기",
    weight: 3,
    instruction: `극적인 상황을 설정하고 선택지 3개를 줘.
3번은 반전이거나 의외의 답.
사주/점성술 개념을 자연스럽게 연결 (선택사항).
질문으로 끝내지 말 것 - 선택지만 주면 사람들이 알아서 댓글 달아.
예시: "자, 상상해봐. [상황]. 제일 먼저 뭐 할 거야?\\n1. ...\\n2. ...\\n3. ... (반전)"`,
  },
  {
    id: "reveal",
    name: "반전 폭로",
    weight: 3,
    instruction: `사주/점성술 개념을 반전 구조로 소개.
"혹시 A보다 센 B보다 센 게 뭔지 알아? 바로 C야." 형식.
C를 설명하고 "너한테도 있을 수 있어" 또는 확인 유도.`,
  },
  {
    id: "thisorthat",
    name: "양자택일",
    weight: 2,
    instruction: `사주/점성술 개념으로 극단적으로 다른 두 유형 대비.
"A vs B, 넌 어느 쪽?" 형식으로 단순하게.
선택만 하면 되니까 댓글 달기 쉽게. 진입장벽 낮추는 게 핵심.
사주 글자·별자리·에너지 차이를 대비해서 보여줘.`,
  },
  {
    id: "check",
    name: "해당여부 확인",
    weight: 2,
    instruction: `특정 사주 글자나 별자리 조합을 나열.
"깔려있어?" "있어?"로 독자가 본인 해당 여부 확인하게.
"축하해. 넌 [특별한 것]이야" 또는 "조심해야 해" 구조.`,
  },
  {
    id: "save",
    name: "저장형 정리",
    weight: 2,
    instruction: `체크리스트·단계별 방법론·비교표 형식.
"저장해두고 나중에 꺼내봐" CTA 직접 작성.
앱 없어도 이해되는 독립형 콘텐츠.
수치·공식화된 팁 위주. 3~5줄 리스트로 정리.`,
  },
  {
    id: "humor",
    name: "공감 유머",
    weight: 2,
    instruction: `공통 경험 (점집, MBTI, 별자리 앱 등)에서 시작.
"그 돈/시간으로 더 나은 걸 했을걸" 반전.
매우 자연스럽고 캐주얼한 친구 말투 유지.`,
  },
  {
    id: "truth",
    name: "불편한 진실",
    weight: 2,
    instruction: `사주 관점의 불편하지만 공감 가는 팩트.
논쟁 유발 - 동의하는 사람과 반론하는 사람 모두 댓글 달게.
직설적이고 솔직한 톤. "반박시 니 말이 맞음" 같은 표현 가능.`,
  },
];

const TOPICS = [
  "화개살 (스님도 파계시키는 매력)",
  "도화살 (인기 있어 보이지만 똥파리 꼬이는 체질)",
  "홍염살 (도화보다 강한 끌림)",
  "역마살 (가만 못 있는 운명)",
  "원진살 (끌리는데 안 맞는 사람)",
  "귀문관살 (예민하고 감각 날카로운 체질)",
  "편인(偏印) - 공부머리 vs 식신 일머리",
  "식신(食神) - 먹복과 표현력",
  "재성(財星) - 돈 그릇 크기",
  "관성(官星) - 직장/명예운",
  "상관(傷官) - 반골 기질",
  "비견/겁재 - 경쟁심과 독립심",
  "돈창고 삼합 (진술축미)",
  "화의 삼합 (인오술) - 불같은 에너지",
  "천을귀인 - 귀인 끌어들이는 글자",
  "문창귀인 - 공부/글재주 운",
  "이직/전직하기 좋은 대운 타이밍",
  "재물운 터지는 시기 보는 법",
  "연애/궁합 - 사주로 보는 이상형",
  "인연복 있는 사주",
  "올해 대운 어떻게 흘러가나",
  "쌍둥이자리 + 사주 교차 분석",
  "전갈자리 + 사주 교차 분석",
  "MBTI가 못 잡는 걸 사주가 잡는 이유",
  "갑자일주 - 자존심과 재능",
  "무진일주 - 돈 잘 버는 체질",
  "경오일주 - 카리스마",
  "임술일주 - 고집과 매력",
  "별자리로 못 보는 걸 사주로 보기",
  "타고난 직업적성 사주로 보기",
];

// ── 구분자 ────────────────────────────────────────────────────────────────
const SEPARATOR = "===FIRST_COMMENT===";

const SYSTEM_PROMPT = `너는 CosmicPath(AI 사주+점성술+타로 앱) Threads 계정 운영자야.
실제로 29만 조회, 9만 조회 받은 포스트들의 톤과 구조를 완벽히 이해하고 있어.

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

function buildFormulaPool() {
  const pool: typeof FORMULAS = [];
  for (const f of FORMULAS) {
    for (let i = 0; i < f.weight; i++) pool.push(f);
  }
  return pool;
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function shuffleTopics(count: number): string[] {
  const shuffled = [...TOPICS].sort(() => Math.random() - 0.5);
  const result: string[] = [];
  while (result.length < count) {
    result.push(...shuffled.slice(0, Math.min(TOPICS.length, count - result.length)));
  }
  return result;
}

const RETRYABLE_STATUSES = new Set([429, 529]);

async function generateOne(
  formula: (typeof FORMULAS)[0],
  topic: string,
  retries = 5,
  delayMs = 3000
): Promise<{ post: string; firstComment: string }> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const message = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 900,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: `[공식: ${formula.name}]\n${formula.instruction}\n\n[주제]\n${topic}\n\n위 공식과 주제로 Threads 포스트 1개 작성해줘.\n작성 후 ${SEPARATOR} 를 출력하고, 바로 아래에 게시 직후 달 첫 댓글을 작성해줘.`,
          },
        ],
      });
      const raw = (message.content[0] as { text: string }).text.trim();
      const parts = raw.split(SEPARATOR);
      const post = parts[0].trim();
      const firstComment = (parts[1] ?? "").trim();
      return { post, firstComment };
    } catch (err: unknown) {
      const status =
        typeof err === "object" && err !== null
          ? (err as { status?: number }).status
          : undefined;
      const shouldRetry = status !== undefined && RETRYABLE_STATUSES.has(status);
      if (shouldRetry && attempt < retries) {
        console.warn(
          `API ${status} (attempt ${attempt}/${retries}). Retrying in ${delayMs * attempt}ms…`
        );
        await new Promise((res) => setTimeout(res, delayMs * attempt));
      } else {
        throw err;
      }
    }
  }
  throw new Error("generateOne: exceeded max retries");
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const count: number = body.count ?? 30;
    const insertAtFront: boolean = body.insertAtFront ?? false;

    if (count < 1 || count > 300) {
      return NextResponse.json({ error: "count는 1~300 사이여야 합니다" }, { status: 400 });
    }

    const formulaPool = buildFormulaPool();
    const topics = shuffleTopics(count);

    const BATCH = 3;
    const BATCH_COOLDOWN = 500;
    const results: { post: string; firstComment: string }[] = [];

    for (let i = 0; i < count; i += BATCH) {
      const batch = Array.from({ length: Math.min(BATCH, count - i) }, (_, j) => {
        const formula = pickRandom(formulaPool);
        const topic = topics[i + j];
        return generateOne(formula, topic);
      });
      const batchResults = await Promise.all(batch);
      results.push(...batchResults);
      if (i + BATCH < count) {
        await new Promise((res) => setTimeout(res, BATCH_COOLDOWN));
      }
    }

    // DB에 저장
    let baseTime = Date.now();
    if (insertAtFront) {
      const earliest = await prisma.post.findFirst({
        where: { status: "PENDING" },
        orderBy: { scheduledAt: "asc" },
      });
      if (earliest) baseTime = earliest.scheduledAt.getTime() - count * 1000;
    } else {
      const latest = await prisma.post.findFirst({
        where: { status: "PENDING" },
        orderBy: { scheduledAt: "desc" },
      });
      if (latest && latest.scheduledAt.getTime() > Date.now()) {
        baseTime = latest.scheduledAt.getTime() + 1000;
      }
    }

    await prisma.post.createMany({
      data: results.map(({ post, firstComment }, i) => ({
        content: post,
        firstComment: firstComment || null,
        imageUrls: "[]",
        scheduledAt: new Date(baseTime + i * 1000),
        status: "PENDING",
      })),
    });

    return NextResponse.json({ success: true, count: results.length });
  } catch (error) {
    console.error("Generate error:", error);
    return NextResponse.json({ error: "생성 실패" }, { status: 500 });
  }
}
