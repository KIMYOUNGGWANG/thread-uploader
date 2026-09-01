/**
 * Marketing Skills Engine — Based on Corey Haines' marketingskills
 * Incorporates 4 Hook Archetypes, 5 Content Pillars, and Anti-Slop Writing Rules.
 */

export type HookArchetype = "curiosity" | "story" | "value" | "contrarian";
export type ContentPillar = "insight" | "story" | "education" | "opinion" | "promotion";

export interface HookDefinition {
  id: HookArchetype;
  label: string;
  description: string;
  templates: string[];
  examples: string[];
}

export interface PillarDefinition {
  id: ContentPillar;
  label: string;
  targetRatio: number; // Percentage
  guidance: string;
}

export const HOOK_ARCHETYPES: Record<HookArchetype, HookDefinition> = {
  curiosity: {
    id: "curiosity",
    label: "호기심 갭 훅 (Curiosity)",
    description: "독자가 알고 있다고 믿는 결과와 실제 숨겨진 원인 사이의 충격적 간극 제시",
    templates: [
      "사람들이 [흔한 원인] 때문에 실패한다고 생각하지만, 진짜 원인은 따로 있습니다.",
      "[놀라운 결과]를 만들었습니다. 걸린 시간은 단 [짧은 기간]이었습니다.",
      "대부분이 [흔한 믿음]을 따르다가 놓치는 핵심 1가지.",
    ],
    examples: [
      "이직이 안 풀리는 이유가 이력서 때문이 아닐 때가 많습니다. 진짜 탈락 원인의 80%는...",
      "견적서 작성 시간을 4시간에서 5분으로 줄였습니다. 방법은 단순했습니다.",
    ],
  },
  story: {
    id: "story",
    label: "생생한 스토리 훅 (Story)",
    description: "독자가 바로 몰입할 수 있는 구체적인 실패, 극적인 변화, 최근 경험 공유",
    templates: [
      "3년 전에는 [과거의 힘든 상태]였습니다. 오늘은 [현재의 상태]가 되었습니다.",
      "지난주, [예상치 못한 사건/실수]를 겪었습니다.",
      "처음 이 결정을 내렸을 때, 주변에서는 다 말렸습니다.",
    ],
    examples: [
      "3년 전 월 150 받던 주니어였습니다. 지금은 혼자서 3개 서비스를 굴립니다.",
      "첫 외주 계약에서 500만 원 사기당할 뻔했던 날 배운 한 가지.",
    ],
  },
  value: {
    id: "value",
    label: "가치 제공/해결 훅 (Value)",
    description: "독자의 고통 없이 원하는 결과를 얻게 해주는 구체적 프레임워크/체크리스트",
    templates: [
      "[흔한 고통/비용] 없이 [원하는 결과]를 얻는 3가지 조건:",
      "절대 하지 말아야 할 실수 [N]가지와 대안:",
      "두고두고 보려고 정리한 [핵심 주제] 5단계 체크리스트:",
    ],
    examples: [
      "야근 없이 칼퇴하면서도 인정받는 기획서 작성 3원칙:",
      "연봉 협상 테이블에서 절대 꺼내면 안 되는 말 3가지와 대안:",
    ],
  },
  contrarian: {
    id: "contrarian",
    label: "상식 뒤집기/역발상 훅 (Contrarian)",
    description: "업계의 뻔한 조언이나 잘못된 관행을 정면으로 반박하며 새로운 시각 제시",
    templates: [
      "불편한 진실: [흔한 조언]은 완전히 틀렸습니다.",
      "모두가 [A]하라고 할 때, 저는 [B]를 선택했습니다. 그 결과:",
      "상식 깨기: [주제]에서 가장 중요한 건 [흔한 기준]이 아닙니다.",
    ],
    examples: [
      "불편한 진실: 열심히 하는 것과 잘하는 건 완전히 다른 문제입니다.",
      "모두가 포트폴리오를 늘리라고 할 때, 저는 1페이지만 남겼습니다.",
    ],
  },
};

export const CONTENT_PILLARS: Record<ContentPillar, PillarDefinition> = {
  insight: {
    id: "insight",
    label: "업계 인사이트 (30%)",
    targetRatio: 0.3,
    guidance: "현업 데이터, 관찰된 시장 변화, 앞으로의 흐름에 대한 날카로운 분석",
  },
  story: {
    id: "story",
    label: "빌딩 & 비하인드 스토리 (25%)",
    targetRatio: 0.25,
    guidance: "실제 제품을 만들거나 문제를 해결하며 겪은 실수, 비하인드, 깨달음",
  },
  education: {
    id: "education",
    label: "실무 교육 & 프레임워크 (25%)",
    targetRatio: 0.25,
    guidance: "독자가 당장 일상이나 업무에 적용할 수 있는 단계별 튜토리얼과 체크리스트",
  },
  opinion: {
    id: "opinion",
    label: "소신 & 핫테이크 (15%)",
    targetRatio: 0.15,
    guidance: "업계의 관행에 대한 솔직한 주관적 견해와 논쟁의 여지가 있는 질문",
  },
  promotion: {
    id: "promotion",
    label: "프로모션 & 오퍼 (5%)",
    targetRatio: 0.05,
    guidance: "구체적 문제 해결 솔루션 제시, 링크 CTA, 명확한 가치 제안",
  },
};

/**
 * Banned generic AI buzzwords (AI Slop - 100 Words).
 * Expanded across Korean promotional cliches, generic transitions, abstract jargon, and English AI markers.
 */
export const BANNED_AI_SLOP_WORDS = [
  // 1. 과장된 수식어 (Korean Buzzwords)
  "혁신적인", "혁신적", "궁극의", "놀라운", "패러다임", "최적화된", "최적화",
  "올인원", "게임체인저", "차세대", "마법 같은", "마법같은", "비약적인",
  "선구적인", "획기적인", "독보적인", "경이로운", "압도적인", "전례 없는",
  "전례없는", "무한한", "기적 같은", "기적같은", "완벽한", "절대적인",

  // 2. 진부한 AI 전개어 및 상투구 (Generic Transitions & Clichés)
  "살펴보겠습니다", "알아보겠습니다", "함께 알아보죠", "놀라운 여정", "새로운 지평",
  "초석", "마침내", "주목해야 할", "주목해야할", "흥미진진한", "눈부신",
  "숨겨진 비밀", "비밀의 열쇠", "비밀을 공개", "놓치지 마세요", "놓치지마세요",
  "지금 바로 확인", "성공의 지름길", "성공의 열쇠", "필수적인", "반드시 알아야",

  // 3. 공허한 추상 명사 및 과장 어휘 (Abstract Jargon)
  "시너지", "시너지 효과", "생태계", "디지털 트랜스포메이션", "포괄적인",
  "다면적인", "심도 있는", "심도있는", "역동적인", "총체적인", "가치 창출",
  "극대화", "잠재력", "잠재력을 발휘", "가능성을 열어", "새로운 차원",
  "탁월한", "눈부시게", "경쟁력을 강화", "차별화된",

  // 4. English AI Slop & Buzzword Markers
  "delve", "delving", "tapestry", "leverage", "leveraging",
  "game-changer", "game changer", "revolutionize", "revolutionizing",
  "unleash", "unleashing", "testament", "pivotal", "beacon",
  "cutting-edge", "state-of-the-art", "groundbreaking", "seamless",
  "seamlessly", "holistic", "empower", "empowering", "foster",
  "fostering", "elevate", "elevating", "embark", "embarking",
  "realm", "bustling", "vibrant", "treasure trove", "dive deep",
  "in conclusion", "furthermore", "moreover", "unlocking", "transformative",
  "bespoke",
];

export interface AntiSlopValidationResult {
  pass: boolean;
  score: number; // 0 to 10
  issues: string[];
  burstinessStdDev?: number;
}

/**
 * Measures sentence length variation (Burstiness) to detect robotic, uniform AI text.
 */
export function validateBurstiness(text: string): { pass: boolean; stdDev: number; issue?: string } {
  const sentences = text
    .split(/[\n.?!]+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 3 && !s.startsWith("http"));

  if (sentences.length < 4) {
    return { pass: true, stdDev: 0 };
  }

  const lengths = sentences.map((s) => s.length);
  const mean = lengths.reduce((acc, val) => acc + val, 0) / lengths.length;
  const variance = lengths.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / lengths.length;
  const stdDev = Math.sqrt(variance);

  // If standard deviation is less than 4.5 on 4+ sentences, it's artificially uniform
  if (stdDev < 4.5) {
    return {
      pass: false,
      stdDev: Math.round(stdDev * 10) / 10,
      issue: `문장 길이가 너무 균일합니다 (표준편차 ${Math.round(stdDev * 10) / 10}자). 단문(10자 내외)과 장문(40자 이상)을 교차하여 인간적인 리듬(Burstiness)을 만드십시오.`,
    };
  }

  return { pass: true, stdDev: Math.round(stdDev * 10) / 10 };
}

/**
 * Validates text against Corey Haines' Anti-Slop copywriting standards.
 */
export function validateAntiSlop(text: string): AntiSlopValidationResult {
  const issues: string[] = [];
  let deduction = 0;

  // 1. Exclamation marks check (Corey Haines: "Exclamation points? Remove them.")
  const exclamationMatches = text.match(/!/g);
  if (exclamationMatches && exclamationMatches.length > 2) {
    deduction += 2;
    issues.push(`느낌표(!)가 ${exclamationMatches.length}회 사용되었습니다. 차분하고 신뢰성 있는 어조를 위해 배제하십시오.`);
  }

  // 2. Banned generic buzzwords (AI Slop 100 words check)
  const lower = text.toLowerCase();
  for (const word of BANNED_AI_SLOP_WORDS) {
    const target = word.toLowerCase();
    if (lower.includes(target)) {
      deduction += 2;
      issues.push(`진부한 AI 상투어 "${word}" 사용 감지: 구체적인 수치나 행동으로 대체하십시오.`);
    }
  }

  // 3. Vague adjectives without numbers
  if (/매우|굉장히|엄청난|엄청나게/.test(text)) {
    deduction += 1;
    issues.push(`모호한 강조 부사(매우, 엄청난 등)를 제거하고 구체적인 사실을 보여주십시오.`);
  }

  // 4. Overly qualified language
  if (/거의\s*모든|어쩌면|아마도/.test(text) && text.split("\n").length <= 4) {
    deduction += 1;
    issues.push(`자신감 없는 수식어(어쩌면, 아마도 등)를 지양하십시오.`);
  }

  // 5. Burstiness Check
  const burstiness = validateBurstiness(text);
  if (!burstiness.pass && burstiness.issue) {
    deduction += 2;
    issues.push(burstiness.issue);
  }

  const score = Math.max(0, 10 - deduction);
  return {
    pass: score >= 7,
    score,
    issues,
    burstinessStdDev: burstiness.stdDev,
  };
}

/**
 * Formats Corey Haines Marketing Skills context for prompt injection.
 */
export function formatMarketingSkillsPrompt(options?: {
  hookArchetype?: HookArchetype;
  pillar?: ContentPillar;
}): string {
  const hook = options?.hookArchetype ? HOOK_ARCHETYPES[options.hookArchetype] : null;
  const pillar = options?.pillar ? CONTENT_PILLARS[options.pillar] : null;

  const lines: string[] = [
    "[Corey Haines 마케팅 지능 프레임워크 (marketingskills)]",
  ];

  if (hook) {
    lines.push(`- 타깃 훅 유형: ${hook.label}`);
    lines.push(`  지침: ${hook.description}`);
    lines.push(`  참고 템플릿: "${hook.templates[0]}"`);
  }

  if (pillar) {
    lines.push(`- 콘텐츠 필러: ${pillar.label}`);
    lines.push(`  방향성: ${pillar.guidance}`);
  }

  lines.push("- 카피라이팅 원칙 (Anti-Slop):");
  lines.push("  1. 똑똑해 보이려 하지 말고 명확하게 쓴다. (Clarity Over Cleverness)");
  lines.push("  2. '혁신적인', '최적화된', '올인원' 같은 뻔한 AI 수식어는 절대 쓰지 않는다.");
  lines.push("  3. 느낌표(!)를 남발하지 않고 차분한 관찰자의 어조를 유지한다.");
  lines.push("  4. 막연한 설명 대신 구체적인 숫자, 시간, 행동 장면을 보여준다. (Show Over Tell)");

  return lines.join("\n");
}
