/**
 * Expert Panel Quality Evaluator
 * Evaluates generated content through 3 distinct personas:
 * 1. Roy Lee (Viral & Stunt Judge) - Controversy, 50% hate test, hook tension, shareability
 * 2. Target User (Resonance & Utility Judge) - Pain point alignment, self-check/save value, clarity
 * 3. Managing Editor (AI Slop & Natural Prose Judge) - 24 AI slop patterns, natural Korean rhythm
 */

export interface PersonaScore {
  persona: "roy_lee" | "target_user" | "managing_editor";
  name: string;
  score: number;
  pass: boolean;
  critique: string;
  flags: string[];
}

export interface ExpertPanelEvaluation {
  overallScore: number;
  pass: boolean;
  personaScores: PersonaScore[];
  blockingReasons: string[];
  recommendations: string[];
}

export interface EvaluationContext {
  topic?: string;
  targetAudience?: string;
  productName?: string;
  offerPromise?: string;
  qualityProfile?: string;
}

// 24 AI Slop and artificial phrasing patterns
export const AI_SLOP_PATTERNS: Array<{ pattern: RegExp; penalty: number; reason: string }> = [
  { pattern: /살펴보겠습니다|알아보겠습니다|살펴볼까요|알아볼까요/, penalty: 20, reason: "강의형/블로그형 어투 (살펴보겠습니다)" },
  { pattern: /뿐만\s*아니라|더\s*나아가|이와\s*같이|이처럼/, penalty: 15, reason: "어색한 접속사 나열" },
  { pattern: /중요한\s*역할을\s*(합니다|하고\s*있습니다)/, penalty: 15, reason: "상투적 AI 설명 (중요한 역할을 합니다)" },
  { pattern: /결론적으로|요약하자면|요약하면\s*다음과\s*같습니다/, penalty: 20, reason: "문서형 결론 맺음말" },
  { pattern: /포기하지\s*마세요|당신은\s*할\s*수\s*있습니다|꽃길만\s*걸으세요|응원합니다!/, penalty: 20, reason: "영혼 없는 generic 동기부여" },
  { pattern: /댓글로\s*(남겨주시면|써주시면)\s*(DM|디엠|자료)/, penalty: 25, reason: "알고리즘 페널티 대상 Engagement Bait" },
  { pattern: /좋아요(를)?\s*누르면\s*(운세|행운|복)/, penalty: 25, reason: "미신적 낚시성 CTA" },
  { pattern: /자수\s*체크|글자\s*수\s*확인|500자\s*이하|본문\s*[:：]|초안\s*작성/, penalty: 30, reason: "생성 메타 텍스트 노출" },
  { pattern: /무조건\s*100%|반드시\s*이루어집니다|상대\s*마음이\s*돌아옵니다/, penalty: 25, reason: "비현실적 과장/보장 표현" },
  { pattern: /###|\*\*서론\*\*|\*\*본론\*\*|\*\*결론\*\*|\*\*소제목\*\*/, penalty: 25, reason: "마크다운 문서형 헤더 잔재" },
  { pattern: /~일\s*수도\s*있고\s*아닐\s*수도\s*있습니다/, penalty: 15, reason: "과도한 회피성 양다리 문장" },
  { pattern: /우리는\s*종종\s*잊곤\s*합니다|현대\s*사회(에서|의)/, penalty: 15, reason: "교과서 서두 진부한 표현" },
  { pattern: /작은\s*습관이\s*모여\s*큰\s*변화를/, penalty: 15, reason: "클리셰 자기계발 문구" },
  { pattern: /궁금하다면\s*끝까지\s*읽어보세요/, penalty: 15, reason: "진부한 낚시형 도입" },
  { pattern: /지금부터\s*그\s*비결을\s*공개합니다/, penalty: 15, reason: "TV 홈쇼핑형 과장 도입" },
  { pattern: /어떻게\s*생각하시나요\?\s*댓글로\s*알려주세요\./, penalty: 15, reason: "수동적 generic 댓글 CTA" },
  { pattern: /선택은\s*여러분의\s*몫입니다/, penalty: 15, reason: "무책임한 결론 종결" },
  { pattern: /함께\s*성장해\s*나아가요/, penalty: 10, reason: "진부한 마무리 인사" },
  { pattern: /놀라운\s*효과를\s*경험해보세요/, penalty: 15, reason: "진부한 마케팅 수식어" },
  { pattern: /다양한\s*관점에서\s*접근/, penalty: 10, reason: "관료적 추상 표현" },
  { pattern: /시사하는\s*바가\s*큽니다/, penalty: 15, reason: "논문형 어투" },
  { pattern: /귀추가\s*주목됩니다/, penalty: 15, reason: "신문 기사형 어투" },
  { pattern: /각양각색의|형형색색의/, penalty: 10, reason: "부자연스러운 번역투/문어체 수식어" },
  { pattern: /마음이\s*웅장해진다/, penalty: 10, reason: "유행 지난 밈 남용" },
];

export function evaluateRoyLee(content: string): PersonaScore {
  const flags: string[] = [];
  let score = 70;

  const firstLine = content.split("\n").find((l) => l.trim().length > 0)?.trim() ?? "";

  // 1. Hook tension
  if (/\?/.test(firstLine)) {
    score += 8;
  }
  if (/(사실|솔직히|근데|오히려|착각|반대로|문제는|최악)/.test(firstLine)) {
    score += 12;
  }
  if (/\d+/.test(firstLine)) {
    score += 5;
  }

  // 2. Bold Point of view (50% hate / clear stance)
  if (/(차이|기준|버려라|하지마|망하는|틀렸다|착각이다)/.test(content)) {
    score += 10;
  } else {
    flags.push("다소 밋밋하고 모두가 동의할 만한 안전한 주장 (50% 혐오/선명한 관점 부족)");
  }

  // 3. Shareability / Self-check trigger
  if (/[ABCabc]\s*[.)]|1\s*[.)]|2\s*[.)]|\[\s*\]|체크/.test(content)) {
    score += 10;
  }

  // Cap score
  score = Math.min(100, Math.max(0, score));

  return {
    persona: "roy_lee",
    name: "Roy Lee (바이럴 & 스턴트 심사관)",
    score,
    pass: score >= 75,
    critique: score >= 85
      ? "도입부 텐션과 선명한 대립각이 살아있어 독자의 스크롤을 멈추게 함."
      : "첫 줄 훅의 마찰력(Tension)을 높이고 주장을 더 날카롭게 다듬어야 함.",
    flags,
  };
}

export function evaluateTargetUser(content: string, context?: EvaluationContext): PersonaScore {
  const flags: string[] = [];
  let score = 75;

  // 1. Utility & Self classification
  const hasClassification = /[ABCabc]\s*[.)]|버팀형|이동형|준비형|유형|체크/.test(content);
  if (hasClassification) {
    score += 12;
  }

  // 2. Save trigger (practical framework, checklists, criteria)
  const hasSaveTrigger = /(저장|기준|정리|체크리스트|판단표|순서|비교)/.test(content);
  if (hasSaveTrigger) {
    score += 8;
  }

  // 3. Audience relevance check
  if (context?.topic && content.includes(context.topic)) {
    score += 5;
  }

  // 4. Overly long or confusing
  if (content.length > 450) {
    score -= 10;
    flags.push("글이 다소 길어 핵심 전달력이 분산됨");
  }

  score = Math.min(100, Math.max(0, score));

  return {
    persona: "target_user",
    name: "타깃 유저 (공감 & 저장 가치 평가원)",
    score,
    pass: score >= 75,
    critique: score >= 85
      ? "내 고민에 직결되는 명확한 프레임과 즉시 써먹을 수 있는 체크 기준이 있음."
      : "타깃의 피부에 와닿는 구체적 상황 묘사와 보관하고 싶은 가치(저장 트리거) 보강 필요.",
    flags,
  };
}

export function evaluateManagingEditor(content: string): PersonaScore {
  const flags: string[] = [];
  let score = 100;

  for (const { pattern, penalty, reason } of AI_SLOP_PATTERNS) {
    if (pattern.test(content)) {
      score -= penalty;
      flags.push(reason);
    }
  }

  // Length check
  if (content.length < 30) {
    score -= 20;
    flags.push("내용이 너무 짧아 맥락이 부족함");
  } else if (content.length > 500) {
    score -= 40;
    flags.push("Threads 단일 포스트 허용 글자수(500자) 초과");
  }

  score = Math.min(100, Math.max(0, score));

  return {
    persona: "managing_editor",
    name: "편집장 (AI Slop & 구어체 리듬 검수관)",
    score,
    pass: score >= 80 && flags.length === 0,
    critique: flags.length === 0
      ? "AI 티가 나지 않고 자연스러운 호흡과 구어체로 완결됨."
      : `AI 상투어 및 문체 결함 감지: ${flags.join(", ")}`,
    flags,
  };
}

export function evaluateContentWithExpertPanel(
  content: string,
  context?: EvaluationContext
): ExpertPanelEvaluation {
  const royLee = evaluateRoyLee(content);
  const targetUser = evaluateTargetUser(content, context);
  const editor = evaluateManagingEditor(content);

  const personaScores = [royLee, targetUser, editor];
  const overallScore = Math.round(royLee.score * 0.35 + targetUser.score * 0.35 + editor.score * 0.30);

  const blockingReasons: string[] = [];
  for (const p of personaScores) {
    if (!p.pass) {
      blockingReasons.push(`${p.name}: ${p.critique}`);
    }
    for (const flag of p.flags) {
      if (!blockingReasons.includes(flag)) {
        blockingReasons.push(flag);
      }
    }
  }

  const recommendations: string[] = [];
  if (!royLee.pass) recommendations.push("첫 문장을 상식을 뒤집는 반전이나 구체적인 질문으로 시작하세요.");
  if (!targetUser.pass) recommendations.push("A/B/C 자기분류 또는 저장해둘 만한 3가지 체크 기준을 명시하세요.");
  if (!editor.pass) recommendations.push("AI 상투 표현을 제거하고 말하듯이 자연스러운 구어체로 다듬으세요.");

  const pass = overallScore >= 80 && editor.pass && royLee.score >= 70 && targetUser.score >= 70;

  return {
    overallScore,
    pass,
    personaScores,
    blockingReasons,
    recommendations,
  };
}
