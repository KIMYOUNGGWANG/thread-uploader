export type ViralIntentModeId =
  | "self_classification"
  | "saveable_tool"
  | "quiet_contrarian"
  | "friend_share"
  | "controversy_stunt"
  | "common_enemy"
  | "modular_audit"
  | "concept_hierarchy"
  | "imagination_dilemma"
  | "identity_profile"
  | "relationship_tension";

export interface ViralIntentMode {
  readonly id: ViralIntentModeId;
  readonly label: string;
  readonly primaryMetric: "replies" | "saves" | "shares" | "profile_visits";
  readonly instruction: string;
  readonly rules: readonly string[];
}

export type ViralModeFidelityFailureCode =
  | "formal_tone"
  | "missing_three_choices"
  | "missing_hierarchy"
  | "missing_identity_marker"
  | "missing_relationship_contrast";

export interface ViralModeFidelityResult {
  readonly pass: boolean;
  readonly failureCodes: readonly ViralModeFidelityFailureCode[];
}

const FORMAL_TONE_PATTERN = /(?:습니다|합니다|됩니다|입니다|하세요|십시오|인가요|셨나요|바랍니다)/;
const HIERARCHY_PATTERN = /보다\s*센|보다|(?:^|\s)vs(?:\s|$)|[<>＜＞]/gi;
const IDENTITY_MARKER_PATTERN = /화개살?|도화살?|홍염살?|문창귀인|천을귀인|진술축미|(?:신금|경금|갑목|을목|병화|정화|무토|기토|임수|계수)\s*(?:일주|타입)/;
const RELATIONSHIP_PATTERN = /연애|궁합|애인|남친|여친|헤어|손절|관계|재회|전남친|전여친/;
const RELATIONSHIP_CONTRAST_PATTERN = /절대|vs|대비|만나면|헤어지|망|놓치|파멸|귀인|원진|상극/;

function extractOpeningLines(content: string, lineCount = 2): string {
  const lines = content.split("\n").map((line) => line.trim());
  const contentLines: string[] = [];
  for (const line of lines) {
    if (!line) continue;
    if (/^(\-{3,}|\*{3,}|={3,})$/.test(line)) continue;
    if (/^#+\s*(📌|\[?메인|threads|post|본문|\d+일차)/i.test(line)) continue;
    if (/^\*\*(본문|포스트|\d+일차|주제).*?\*\*$/i.test(line)) continue;
    if (/^\[(본문|포스트|\d+일차|주제)\]/i.test(line)) continue;
    contentLines.push(line.replace(/^#+\s*/, ""));
    if (contentLines.length >= lineCount) break;
  }
  return contentLines.join("\n");
}

export function checkViralModeFidelity(
  content: string,
  modeId: ViralIntentModeId
): ViralModeFidelityResult {
  const failureCodes: ViralModeFidelityFailureCode[] = [];
  const opening = extractOpeningLines(content, 2);

  if (FORMAL_TONE_PATTERN.test(content)) failureCodes.push("formal_tone");
  if (modeId === "imagination_dilemma" && !hasThreeNumberedChoices(content)) {
    failureCodes.push("missing_three_choices");
  }
  if (modeId === "concept_hierarchy" && (opening.match(HIERARCHY_PATTERN)?.length ?? 0) < 2) {
    failureCodes.push("missing_hierarchy");
  }
  if (modeId === "identity_profile" && !IDENTITY_MARKER_PATTERN.test(opening)) {
    failureCodes.push("missing_identity_marker");
  }
  if (
    modeId === "relationship_tension"
    && (!RELATIONSHIP_PATTERN.test(opening) || !RELATIONSHIP_CONTRAST_PATTERN.test(opening))
  ) {
    failureCodes.push("missing_relationship_contrast");
  }

  return { pass: failureCodes.length === 0, failureCodes };
}

function hasThreeNumberedChoices(content: string): boolean {
  return [1, 2, 3].every((number) => new RegExp(`^\\s*${number}[.)]\\s`, "m").test(content));
}

export const VIRAL_INTENT_MODES: readonly ViralIntentMode[] = [
  {
    id: "self_classification",
    label: "자기분류 셀프체크",
    primaryMetric: "saves",
    instruction: "독자가 A/B/C 또는 4방향 판정을 본문 안에서 혼자 체크하게 만든다.",
    rules: [
      "댓글을 요구하지 않고 저장하거나 스스로 표시해도 완결되게 쓴다.",
      "장문 사연 요청 금지.",
      "개인 질문 접수, 답글 약속, 무료 풀이 약속 금지.",
    ],
  },
  {
    id: "saveable_tool",
    label: "저장형 판단 도구",
    primaryMetric: "saves",
    instruction: "나중에 다시 볼 체크리스트, 판정표, 순서표로 만든다.",
    rules: [
      "독자가 저장하거나 캡처하고 싶게 3-4칸 도구처럼 쓴다.",
      "댓글 없이도 가치가 완결되게 쓴다.",
      "미래 확정 대신 다음 행동 기준을 준다.",
    ],
  },
  {
    id: "quiet_contrarian",
    label: "조용한 반전",
    primaryMetric: "profile_visits",
    instruction: "흔한 업계 통념이나 잘못된 고정관념을 차분하게 뒤집는다.",
    rules: [
      "불안을 찌르지 않고 잘못된 질문 구조를 짚는다.",
      "마지막은 저장, 프로필 확인, 또는 행동선 정리로 닫는다.",
    ],
  },
  {
    id: "friend_share",
    label: "친구/실화 관찰 썰형",
    primaryMetric: "replies",
    instruction: "친구의 실제 고민 관찰 썰이나 본인 경험담으로 훅을 열고, 공감과 함께 댓글로 참여하게 만든다.",
    rules: [
      "실제 겪은 일처럼 날것의 대화체(반말/독백체)로 쓴다.",
      "광고성 설명충 문장을 빼고, 궁금증을 자극해 댓글로 반응하게 만든다.",
    ],
  },
  {
    id: "controversy_stunt",
    label: "도발적 이슈메이킹 (사이다 도발)",
    primaryMetric: "replies",
    instruction: "업계의 잘못된 고정관념이나 미신을 도발적으로 질타하며 뜨거운 댓글 반응을 끌어낸다.",
    rules: [
      "모두가 의구심을 품었지만 아무도 말하지 못한 답답한 현실을 찌른다.",
      "반말과 독백체로 직설적인 사이다 의견을 제시한다.",
    ],
  },
  {
    id: "common_enemy",
    label: "공공의 적 타격형 (불합리 저격)",
    primaryMetric: "shares",
    instruction: "타겟 고객군이 공통으로 겪는 억울한 상황이나 답답한 인간관계를 정면 저격한다.",
    rules: [
      "타겟 고객이 억울해하던 대표적 불이익 사례를 구체적으로 묘사한다.",
      "연대감을 형성하며 공감 댓글을 이끌어낸다.",
    ],
  },
  {
    id: "modular_audit",
    label: "7단계 엔진 감사형 (Modular Audit)",
    primaryMetric: "saves",
    instruction: "이직/퇴사/커리어 의사결정을 7단계 모듈러 엔진 분업화 프레임으로 감사(Audit)하여 저장 및 프로필 전환을 유도한다.",
    rules: [
      "1~5단계는 완결된 자가진단 기준과 체크리스트로 작성해 저장 가치를 극대화한다.",
      "6~7단계는 핵심 결론(개인별 탈출 골든타임 및 손절선)으로 남겨두고 첫 댓글 링크 확인을 유도한다(Curiosity Gap).",
      "댓글에 특정 단어 남기면 DM 발송 등의 Reply-Burden 금지.",
      "근거 없는 100% 미래 확정 표현 금지.",
    ],
  },
  {
    id: "concept_hierarchy",
    label: "개념 서열 비교 & 상식 파괴 (Concept Hierarchy)",
    primaryMetric: "saves",
    instruction: "대중이 아는 통념적 개념(A)보다 더 본질적인 B, C를 비교하여 상식을 깨고 극단적 1줄 앵커로 저장과 인게이지먼트를 유도한다.",
    rules: [
      "첫 문장은 'A보다 센 B보다 센 게 뭔지 알아?' 식의 극단적 대비 서열 구조로 연다.",
      "근거 없는 미신이나 공포 조장 금지. 결정론적/구조적 프레임으로 설명.",
      "본문 내 직접 링크 노출 금지, 첫 댓글에 무료 판정 기준표/브릿지 배치.",
      "단순 A/B/C 자가분류 댓글 강요 금지.",
    ],
  },
  {
    id: "imagination_dilemma",
    label: "초저마찰 3지선다 딜레마 (30만 뷰 1등 검증)",
    primaryMetric: "replies",
    instruction: "극단적 상황이나 상상(로또 1등, 카드값, 퇴사 딜레마 등)을 날것의 구어로 던지고 1초 만에 1/2/3 선택지를 고르게 만들어 댓글 폭발을 유도한다.",
    rules: [
      "도입부는 '자, 상상해봐' 또는 즉각적 일상 딜레마 상황으로 시작한다.",
      "1초 만에 선택 가능한 직관적이고 극단적인 3개 번호 선택지를 제시한다.",
      "구구절절한 설명 문장을 배제하고 선택지만 명확히 남겨 댓글 참여 마찰력을 최소화한다.",
    ],
  },
  {
    id: "identity_profile",
    label: "특정 기질/살/일주 프로파일링 (2.2만 뷰 3등 검증)",
    primaryMetric: "saves",
    instruction: "사주에 '진술축미', '화개살', '문창귀인'이 있거나 '신금/경금' 일주인 사람들의 숨겨진 강점과 맹점을 팩폭으로 프로파일링하여 강한 자기 투사와 저장을 유도한다.",
    rules: [
      "특정 글자, 살, 일주를 1줄에 직설적으로 호명하여 스크롤을 멈추게 한다.",
      "두루뭉술한 위로 대신 날카로운 양면성(치명적 무기 vs 발목 잡는 덫)을 짚는다.",
      "본문 링크 금지, 첫 댓글에 5대 엔진 내 원국 확인 브릿지를 배치한다.",
    ],
  },
  {
    id: "relationship_tension",
    label: "관계 손절 및 궁합 텐션 팩폭 (2.3만 뷰 4등 검증)",
    primaryMetric: "shares",
    instruction: "절대 헤어지면 안 되는 궁합 vs 만나면 파멸하는 궁합, 또는 전남친/손절 타이밍을 팩트로 분석하여 독자의 깊은 공감과 공유/댓글을 이끌어낸다.",
    rules: [
      "감정적 연애 상담이 아니라 구조적 기질 궁합의 충돌 원리를 설명한다.",
      "단정적 미래 확정 대신 리스크 헷징 관점을 제시한다.",
      "첫 댓글에 궁합/관계 결핍 해소 브릿지를 배치한다.",
    ],
  },
];

const SPRINT_GROUP_SIZE = 7;
const LEGACY_FORMULA_MAP: Record<string, ViralIntentModeId> = {
  comment_diagnosis: "self_classification",
  friend_tag: "friend_share",
  self_confession: "quiet_contrarian",
  controversy: "controversy_stunt",
  enemy_strike: "common_enemy",
  modular_audit: "modular_audit",
  modular_7_engine: "modular_audit",
  concept_hierarchy: "concept_hierarchy",
  lotto_zero_friction: "imagination_dilemma",
  imagination_dilemma: "imagination_dilemma",
  identity_profile: "identity_profile",
  saturn_return_career_reset: "identity_profile",
  relationship_tension: "relationship_tension",
  synastry_avoidant_trap: "relationship_tension",
  destiny_partner_sign: "relationship_tension",
};

export function normalizeViralIntentModeId(input: unknown): ViralIntentModeId | null {
  if (
    input === "self_classification" ||
    input === "saveable_tool" ||
    input === "quiet_contrarian" ||
    input === "friend_share" ||
    input === "controversy_stunt" ||
    input === "common_enemy" ||
    input === "modular_audit" ||
    input === "concept_hierarchy" ||
    input === "imagination_dilemma" ||
    input === "identity_profile" ||
    input === "relationship_tension"
  ) {
    return input;
  }
  return typeof input === "string" ? LEGACY_FORMULA_MAP[input] ?? null : null;
}

/**
 * 15-Post Master Sprint Allocation (1,600 live posts ground truth):
 * - 4개: 29.9만 뷰 1등 imagination_dilemma (로또/현실 3지선다)
 * - 4개: 12.2만/4.0만/2.2만 뷰 2등 concept_hierarchy (도화vs홍염vs화개 서열)
 * - 4개: 2.2만/1.2만/1.1만 뷰 3등 identity_profile (화개살/문창귀인/신금일주)
 * - 3개: 2.3만/9천 뷰 4등 relationship_tension (궁합/손절/관계 타이밍)
 */
export const LEAN_SPRINT_ALLOCATION: readonly ViralIntentModeId[] = [
  "imagination_dilemma", // 1. 30만 뷰 딜레마 (도달 펌핑)
  "concept_hierarchy",   // 2. 12만 뷰 개념 서열 (저장 펌핑)
  "identity_profile",    // 3. 2.2만 뷰 살/일주 프로파일링 (자기 투사)
  "relationship_tension",// 4. 2.3만 뷰 궁합/관계 텐션 (공유)
  "imagination_dilemma", // 5. 30만 뷰 딜레마
  "concept_hierarchy",   // 6. 12만 뷰 개념 서열
  "identity_profile",    // 7. 2.2만 뷰 살/일주 프로파일링
  "relationship_tension",// 8. 2.3만 뷰 궁합/관계 텐션
  "imagination_dilemma", // 9. 30만 뷰 딜레마
  "concept_hierarchy",   // 10. 12만 뷰 개념 서열
  "identity_profile",    // 11. 2.2만 뷰 살/일주 프로파일링
  "relationship_tension",// 12. 2.3만 뷰 궁합/관계 텐션
  "imagination_dilemma", // 13. 30만 뷰 딜레마
  "concept_hierarchy",   // 14. 12만 뷰 개념 서열
  "identity_profile",    // 15. 2.2만 뷰 살/일주 프로파일링
];

export function selectViralIntentMode(
  index: number,
  options?: { sprintType?: "lean_14day" | "lean_15post" | "standard_28day" }
): ViralIntentMode {
  const normalizedIndex = Math.max(0, Math.floor(index));
  if (options?.sprintType === "lean_14day" || options?.sprintType === "lean_15post") {
    const leanId = LEAN_SPRINT_ALLOCATION[normalizedIndex % LEAN_SPRINT_ALLOCATION.length];
    return VIRAL_INTENT_MODES.find((m) => m.id === leanId) ?? VIRAL_INTENT_MODES[0];
  }
  const modeIndex = Math.floor(normalizedIndex / SPRINT_GROUP_SIZE) % VIRAL_INTENT_MODES.length;
  return VIRAL_INTENT_MODES[modeIndex] ?? VIRAL_INTENT_MODES[0];
}

export function resolveViralIntentMode(formulaId: string | null, fallbackIndex: number): ViralIntentMode {
  const normalizedId = normalizeViralIntentModeId(formulaId);
  return VIRAL_INTENT_MODES.find((mode) => mode.id === normalizedId) ?? selectViralIntentMode(fallbackIndex);
}

export const ENGLISH_VIRAL_MODE_LABELS: Record<ViralIntentModeId, { label: string; instruction: string; rules: string[] }> = {
  self_classification: {
    label: "Self-Classification Check",
    instruction: "Make the reader privately self-check their type (e.g. Type A/B/C or 4-quadrant verdict) inside the post.",
    rules: [
      "Do not force replies; the value must be complete even if saved or mentally selected.",
      "Never solicit long life stories or personal confessions in comments.",
      "Never promise individual readings or replies.",
    ],
  },
  saveable_tool: {
    label: "Saveable Decision Tool",
    instruction: "Structure as a 3-4 row checklist, scorecard, or sequence guide worth bookmarking.",
    rules: [
      "Craft it like a utility the reader wants to save or screenshot.",
      "Provide actionable decision criteria rather than vague future predictions.",
    ],
  },
  quiet_contrarian: {
    label: "Quiet Contrarian Flip",
    instruction: "Calmly dismantle a widespread industry myth or flawed conventional wisdom.",
    rules: [
      "Point out the flawed premise without triggering anxiety.",
      "Close with a save/profile visit trigger or clear action framework.",
    ],
  },
  friend_share: {
    label: "Relatable Observation / Share Hook",
    instruction: "Open with a real-life observation or raw personal confession that sparks immediate resonance.",
    rules: [
      "Write in a raw, authentic first-person voice.",
      "Eliminate corporate sales tone to drive organic engagement.",
    ],
  },
  controversy_stunt: {
    label: "Provocative Stunt Hook",
    instruction: "Challenge an unquestioned sacred cow or consensus belief to spark intense discussion.",
    rules: [
      "Focus on the structural flaw of conventional advice.",
      "Maintain analytical authority without resorting to cheap insults.",
    ],
  },
  common_enemy: {
    label: "Common Enemy Reality Check",
    instruction: "Expose fake comforting advice or generic superficial horoscopes.",
    rules: [
      "Attack the unhelpful industry norm, not the audience.",
      "Provide harsh but liberating deterministic clarity.",
    ],
  },
  modular_audit: {
    label: "Modular Decision Audit",
    instruction: "Present a progressive multi-point audit framework.",
    rules: [
      "Provide clear self-audit markers for initial stages.",
      "Direct to profile / reading for advanced breakdown.",
    ],
  },
  concept_hierarchy: {
    label: "Concept Hierarchy / Contrarian Anchor",
    instruction: "Break conventional wisdom by contrasting familiar concept A with deeper realities B and C, anchoring with high tension.",
    rules: [
      "Open with an extreme tier hierarchy contrast hook.",
      "Explain the structural mismatch rather than fearmongering.",
      "Avoid raw links in the main post; place the bridge in the first comment.",
    ],
  },
  imagination_dilemma: {
    label: "3-Choice Imagination Dilemma",
    instruction: "Open with an extreme relatable hypothetical situation and offer 3 distinct choices for instant replies.",
    rules: [
      "Open with an immediate hook: 'Imagine this...' or an extreme everyday dilemma.",
      "Provide 3 intuitive, highly differentiated numbered choices.",
      "Eliminate lengthy prose to keep reply friction at absolute zero.",
    ],
  },
  identity_profile: {
    label: "Archetype / Star / Pillar Profiling",
    instruction: "Profile specific natal markers (pillars, special stars, elements) with sharp psychological accuracy to drive deep self-projection and saves.",
    rules: [
      "Explicitly name the specific star or pillar in the opening line to stop the scroll.",
      "Diagnose the sharp double-edged sword (deadly asset vs hidden trap) rather than generic comfort.",
      "Never put raw links in the body; place the engine diagnosis bridge in the first comment.",
    ],
  },
  relationship_tension: {
    label: "Relational Tension & Synastry Reality Check",
    instruction: "Deconstruct irreconcilable synastry clashes vs unbreakable bonds with structural logic to trigger intense shares and discussions.",
    rules: [
      "Analyze structural trait collisions rather than superficial dating advice.",
      "Frame advice as emotional risk hedging rather than deterministic fortune-telling.",
      "Attach a relational timing / synastry bridge in the first comment.",
    ],
  },
};

export function formatViralIntentModePrompt(mode: ViralIntentMode, isEnglish = false): string {
  const en = isEnglish ? ENGLISH_VIRAL_MODE_LABELS[mode.id] : null;
  if (en) {
    return [
      "[Viral Intent Mode]",
      `id: ${mode.id}`,
      `Name: ${en.label}`,
      `Success Metric: ${mode.primaryMetric}`,
      `Objective: ${en.instruction}`,
      ...en.rules.map((rule) => `- ${rule}`),
    ].join("\n");
  }
  return [
    "[바이럴 의도 모드]",
    `id: ${mode.id}`,
    `이름: ${mode.label}`,
    `성공 지표: ${mode.primaryMetric}`,
    `목표: ${mode.instruction}`,
    ...mode.rules.map((rule) => `- ${rule}`),
  ].join("\n");
}

export function hasSelfClassificationMechanic(content: string): boolean {
  return (
    /A\s*[./)]|A\s*\/\s*B|A\.\s*|B\.\s*|C\.\s*/i.test(content) ||
    /\b[ABC]\b[\.\:\-\)]/i.test(content) ||
    /archetype/i.test(content) ||
    /which\s*(one|type|matches|are\s*you)/i.test(content) ||
    /(연락|움직임|확장)\s*\/\s*(대기|보수)\s*\/\s*(축소|정리)\s*\/\s*보류/.test(content)
  );
}

export function hasSaveShareMechanic(content: string): boolean {
  return (
    /저장|공유|보관|체크리스트|순서표|판정표/i.test(content) ||
    /save|share|bookmark|checklist/i.test(content) ||
    /스스로\s*체크|나중에\s*다시/i.test(content)
  );
}

export function hasLowTouchEngagementMechanic(content: string): boolean {
  return hasSelfClassificationMechanic(content) || hasSaveShareMechanic(content);
}

export function hasReplyBurdenPromise(content: string): boolean {
  return (
    /댓글(을|로|에)?\s*(남겨|주시면|달아|써줘|작성)/i.test(content) ||
    /(사연|질문|상황)\s*(접수|남겨|남기|써줘|써|적어)/i.test(content) ||
    /(답글|풀이)\s*(약속|해줄|해드릴|달아)/i.test(content) ||
    /1:1\s*(상담|대화|진단|풀이)/i.test(content) ||
    /같이\s*(보|봐)/i.test(content)
  );
}

export function hasFortuneOverclaim(content: string): boolean {
  return (
    /100%|미래가\s*확정|미래를\s*보장|운명이\s*정해진|(?:사주|운세|미래|대운|운명|결과|마음)(?:가|는|를|도|이)?\s*(?:확실|무조건|반드시|100%)/i.test(content) ||
    /(?:확실|무조건|반드시)\s*(?:맞|보장|성공|해결|알려|적중|예측|실현|바꿔)/i.test(content)
  );
}
