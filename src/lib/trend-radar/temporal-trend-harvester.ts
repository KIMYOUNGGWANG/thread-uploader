import { calculateSearchSignalScore } from "@/lib/viral-analysis";

export type TargetDomainCategory = "CAREER_CONFLICT" | "WEALTH_PANIC" | "RELATIONSHIP_TOXICITY";

export interface AbstractedTrendSkeleton {
  id: string;
  domain: TargetDomainCategory;
  sourceQuery: string;
  unspokenAnxiety: string;
  cognitiveDissonance: string;
  choiceOptions: [string, string, string];
  headlineHook: string;
  harvestedAt: string;
}

export interface ThreadsTrendSample {
  text: string;
  username?: string;
  timestamp?: string;
}

const SAMPLE_WINDOW_MS = 72 * 60 * 60 * 1000;
const MAX_SAMPLES_PER_DOMAIN = 12;
const MAX_SAMPLE_CHARS = 280;
const REPLIES_BONUS = 5;

// Threads keyword search terms per domain; searched with the brand's own token.
// 8 per domain: enough for the keyword-overlap signal to mean something, 24 calls a day in total.
// Keep terms unique across domains so one post does not count as "overlap" in two domains.
export const DOMAIN_THREADS_KEYWORDS: Record<TargetDomainCategory, string[]> = {
  CAREER_CONFLICT: ["이직", "퇴사", "번아웃", "권고사직", "수습 탈락", "연봉 협상", "이직 실패", "퇴사 고민"],
  WEALTH_PANIC: ["손절", "영끌", "코인", "물타기", "하우스푸어", "청산", "존버", "전재산"],
  RELATIONSHIP_TOXICITY: ["잠수이별", "회피형", "가스라이팅", "환승이별", "재회", "썸 타이밍", "친구 손절", "헌신"],
};

export interface ThreadsKeywordResult {
  keyword: string;
  posts: Array<{ id: string; text?: string; username?: string; timestamp?: string; has_replies?: boolean }>;
}

/**
 * Picks the posts that are actually travelling, not merely the newest ones.
 * Threads search returns no engagement counts, so the same proxy as the viral cron is used:
 * TOP-search rank per keyword, overlap across keywords, plus a small bump for posts that drew replies.
 * Only posts from the last 72h qualify; text is trimmed so the prompt stays bounded.
 */
export function selectThreadsTrendSamples(results: ThreadsKeywordResult[], now: Date = new Date()): ThreadsTrendSample[] {
  const cutoff = now.getTime() - SAMPLE_WINDOW_MS;
  const byId = new Map<string, { post: ThreadsKeywordResult["posts"][number]; bestRank: number; keywordHits: number }>();
  for (const { posts } of results) {
    posts.forEach((post, index) => {
      if (!post.text?.trim()) return;
      const parsedAt = Date.parse(post.timestamp ?? "");
      if (!Number.isFinite(parsedAt) || parsedAt < cutoff || parsedAt > now.getTime()) return;
      const rank = index + 1;
      const seen = byId.get(post.id);
      byId.set(post.id, {
        post,
        bestRank: Math.min(seen?.bestRank ?? rank, rank),
        keywordHits: (seen?.keywordHits ?? 0) + 1,
      });
    });
  }

  return Array.from(byId.values())
    .map((entry) => ({
      ...entry,
      score: calculateSearchSignalScore({ searchRank: entry.bestRank, keywordHits: entry.keywordHits }) + (entry.post.has_replies ? REPLIES_BONUS : 0),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_SAMPLES_PER_DOMAIN)
    .map(({ post }) => ({ text: post.text!.trim().slice(0, MAX_SAMPLE_CHARS), username: post.username, timestamp: post.timestamp }));
}

function formatThreadsSamples(samples: ThreadsTrendSample[]): string {
  if (samples.length === 0) return "";
  // Usernames stay out of the prompt: we want the tension, never the person.
  const lines = samples.map((sample, index) => `${index + 1}. ${sample.text.replace(/\s+/g, " ")}`);
  return [
    `[Threads 실제 게시물 ${samples.length}개 (최근 72시간, 키워드 검색 TOP)]`,
    "아래 글들은 실제 Threads에서 지금 반응이 나오는 글이다. 웹 검색 결과와 함께 근거로 삼되, 작성자나 고유명사는 절대 추출하지 마라.",
    ...lines,
  ].join("\n");
}

const DOMAIN_ANCHOR_PROMPTS: Record<TargetDomainCategory, string> = {
  CAREER_CONFLICT:
    "대기업/유명 스타트업 네임밸류 믿고 이직 후 1년 내 번아웃, 결산 직후 권고사직, 동기 대비 연봉 격차, 수습 평가 탈락",
  WEALTH_PANIC:
    "코인/주식 억대 수익 후 손절 타이밍 실패로 전재산 반토막, 영끌 매수 후 하우스푸어 전락, 욕심으로 인한 청산",
  RELATIONSHIP_TOXICITY:
    "회피형 애인의 잠수이별, 직장 상사의 가스라이팅, 헌신하다 버림받는 기생적 관계, 손절 타이밍을 놓친 파멸",
};

export function buildTemporalSearchPrompt(
  domain: TargetDomainCategory,
  referenceDate: Date = new Date(),
  threadsSamples: ThreadsTrendSample[] = []
): string {
  const dateStr = referenceDate.toISOString().slice(0, 10);
  const anchorTheme = DOMAIN_ANCHOR_PROMPTS[domain];
  const threadsBlock = formatThreadsSamples(threadsSamples);

  return `
[기준일자: ${dateStr}]
최근 72시간 이내 한국 2030 직장인/청년 커뮤니티(Threads, 블라인드, 직장인 포럼, 재테크 커뮤니티)에서 높은 댓글 논쟁과 공감을 일으킨 '${domain}' 관련 사례를 심층 조사하라.

주요 테마: ${anchorTheme}
${threadsBlock ? `\n${threadsBlock}\n` : ""}
[출력 요구사항 (반드시 JSON 형식)]
단순 사건 뉴스나 고유명사 텍스트는 버리고, 대중의 '심리적 결핍'과 '3지선다 선택지 구조'만 추출하여 아래 JSON 규격으로 반환하라:
\`\`\`json
[
  {
    "unspokenAnxiety": "독자가 남들에게 말 못 하는 은밀한 불안 (1~2문장)",
    "cognitiveDissonance": "상식적인 믿음이 배신당한 인지 부조화 상황 (1~2문장)",
    "headlineHook": "독자의 스크롤을 멈추게 할 도발적 훅 헤드라인 (30자 내외)",
    "choiceOptions": [
      "선택지 A: 버팀형/순응형 처지 설명",
      "선택지 B: 이동형/도피형 처지 설명",
      "선택지 C: 준비형/관망형 처지 설명"
    ]
  }
]
\`\`\`
`.trim();
}

export function parseAbstractedTrendResponse(
  rawResponse: string,
  domain: TargetDomainCategory,
  sourceQuery: string,
  referenceDate: Date = new Date()
): AbstractedTrendSkeleton[] {
  const trimmed = rawResponse.trim();
  const dateStr = referenceDate.toISOString();

  // 1. Try JSON extraction
  const jsonMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || trimmed.match(/(\[[\s\S]*\])/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[1]);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((item, index) => {
          const rawOptions = Array.isArray(item.choiceOptions) ? item.choiceOptions : [];
          const optA = rawOptions[0] || "A. 버팀형: 현 상태 유지";
          const optB = rawOptions[1] || "B. 이동형: 환경 변화 모색";
          const optC = rawOptions[2] || "C. 준비형: 리소스 비축";

          return {
            id: `trend-${domain.toLowerCase()}-${Date.now()}-${index}`,
            domain,
            sourceQuery,
            unspokenAnxiety: String(item.unspokenAnxiety || "변화에 대한 불안감"),
            cognitiveDissonance: String(item.cognitiveDissonance || "믿었던 기준의 붕괴"),
            choiceOptions: [optA, optB, optC],
            headlineHook: String(item.headlineHook || `${domain}에서 겪는 치명적 착각`),
            harvestedAt: dateStr,
          };
        });
      }
    } catch {
      // fallback to regex
    }
  }

  // 2. Fallback text parsing
  const firstLine = trimmed.split("\n").find((l) => l.trim().length > 0) || "트렌드 갈등 분석";
  const cleanHeadline = firstLine.replace(/^(헤드라인|주제|제목)\s*[:：]?\s*/, "").trim();

  return [
    {
      id: `trend-${domain.toLowerCase()}-${Date.now()}-fallback`,
      domain,
      sourceQuery,
      unspokenAnxiety: "타이밍을 놓치고 손해 볼 것이라는 불안",
      cognitiveDissonance: "노력과 결과의 불일치",
      choiceOptions: [
        "A. 버팀형: 현재 자리에서 인내",
        "B. 이동형: 즉각적 손절 및 이탈",
        "C. 준비형: 기회를 기다리며 준비",
      ],
      headlineHook: cleanHeadline,
      harvestedAt: dateStr,
    },
  ];
}

export async function harvestTemporalTrends(options: {
  domains?: TargetDomainCategory[];
  referenceDate?: Date;
  queryFn: (prompt: string) => Promise<string>;
  threadsSamplesFn?: (domain: TargetDomainCategory) => Promise<ThreadsTrendSample[]>;
}): Promise<AbstractedTrendSkeleton[]> {
  const domains = options.domains || ["CAREER_CONFLICT", "WEALTH_PANIC", "RELATIONSHIP_TOXICITY"];
  const refDate = options.referenceDate || new Date();
  const allResults: AbstractedTrendSkeleton[] = [];

  for (const domain of domains) {
    const samples = options.threadsSamplesFn ? await options.threadsSamplesFn(domain) : [];
    const prompt = buildTemporalSearchPrompt(domain, refDate, samples);
    try {
      const response = await options.queryFn(prompt);
      const skeletons = parseAbstractedTrendResponse(response, domain, DOMAIN_ANCHOR_PROMPTS[domain], refDate);
      allResults.push(...skeletons);
    } catch (err) {
      console.error(`[harvestTemporalTrends] Failed for domain ${domain}:`, err);
    }
  }

  return allResults;
}
