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
  referenceDate: Date = new Date()
): string {
  const dateStr = referenceDate.toISOString().slice(0, 10);
  const anchorTheme = DOMAIN_ANCHOR_PROMPTS[domain];

  return `
[기준일자: ${dateStr}]
최근 72시간 이내 한국 2030 직장인/청년 커뮤니티(블라인드, 직장인 포럼, 재테크 커뮤니티)에서 높은 댓글 논쟁과 공감을 일으킨 '${domain}' 관련 사례를 심층 조사하라.

주요 테마: ${anchorTheme}

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
}): Promise<AbstractedTrendSkeleton[]> {
  const domains = options.domains || ["CAREER_CONFLICT", "WEALTH_PANIC", "RELATIONSHIP_TOXICITY"];
  const refDate = options.referenceDate || new Date();
  const allResults: AbstractedTrendSkeleton[] = [];

  for (const domain of domains) {
    const prompt = buildTemporalSearchPrompt(domain, refDate);
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
