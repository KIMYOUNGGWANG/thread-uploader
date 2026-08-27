export type ViralIntentModeId =
  | "self_classification"
  | "saveable_tool"
  | "quiet_contrarian"
  | "friend_share"
  | "controversy_stunt"
  | "common_enemy";

export interface ViralIntentMode {
  readonly id: ViralIntentModeId;
  readonly label: string;
  readonly primaryMetric: "replies" | "saves" | "shares" | "profile_visits";
  readonly instruction: string;
  readonly rules: readonly string[];
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
    label: "친구 공유형",
    primaryMetric: "shares",
    instruction: "같은 고민을 하는 친구에게 보내주고 싶게 쓴다.",
    rules: [
      "친구 태그/공유가 자연스럽게 생길 만한 상황을 콕 집는다.",
      "공유 후에도 운영자 답글이 필요 없는 구조로 쓴다.",
    ],
  },
  {
    id: "controversy_stunt",
    label: "도발적 이슈메이킹 (Roy Lee Stunt)",
    primaryMetric: "replies",
    instruction: "산업 내의 금기나 통념을 도발적으로 질타하며 뜨거운 논쟁 반응을 끌어낸다.",
    rules: [
      "모두가 의구심을 품었지만 아무도 말하지 못한 업계의 비효율/불합리를 찌른다.",
      "자극적 훅 이후 솔루션과 메인 메시지 간 확실한 명분(Conversion Alignment)을 제공한다.",
    ],
  },
  {
    id: "common_enemy",
    label: "공공의 적 타격형 (Common Enemy)",
    primaryMetric: "shares",
    instruction: "타겟 고객군이 공통으로 증오하는 업계 불공정 관행을 정면 저격한다.",
    rules: [
      "타겟 고객이 억울해하던 대표적 불이익 사례를 구체적으로 묘사한다.",
      "대안적인 해결책이나 당당한 대처 자세로 연대감을 형성한다.",
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
};

export function normalizeViralIntentModeId(input: unknown): ViralIntentModeId | null {
  if (
    input === "self_classification" ||
    input === "saveable_tool" ||
    input === "quiet_contrarian" ||
    input === "friend_share" ||
    input === "controversy_stunt" ||
    input === "common_enemy"
  ) {
    return input;
  }
  return typeof input === "string" ? LEGACY_FORMULA_MAP[input] ?? null : null;
}

export function selectViralIntentMode(index: number): ViralIntentMode {
  const normalizedIndex = Math.max(0, Math.floor(index));
  const modeIndex = Math.floor(normalizedIndex / SPRINT_GROUP_SIZE) % VIRAL_INTENT_MODES.length;
  return VIRAL_INTENT_MODES[modeIndex] ?? VIRAL_INTENT_MODES[0];
}

export function resolveViralIntentMode(formulaId: string | null, fallbackIndex: number): ViralIntentMode {
  const normalizedId = normalizeViralIntentModeId(formulaId);
  return VIRAL_INTENT_MODES.find((mode) => mode.id === normalizedId) ?? selectViralIntentMode(fallbackIndex);
}

export function formatViralIntentModePrompt(mode: ViralIntentMode): string {
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
    /(연락|움직임|확장)\s*\/\s*(대기|보수)\s*\/\s*(축소|정리)\s*\/\s*보류/.test(content)
  );
}

export function hasSaveShareMechanic(content: string): boolean {
  return (
    /저장|공유|보관|체크리스트|순서표|판정표/i.test(content) ||
    /스스로\s*체크|나중에\s*다시/i.test(content)
  );
}

export function hasLowTouchEngagementMechanic(content: string): boolean {
  return hasSelfClassificationMechanic(content) || hasSaveShareMechanic(content);
}

export function hasReplyBurdenPromise(content: string): boolean {
  return (
    /댓글(을|로|에)?\s*(남겨|주시면|달아|써줘|작성)/i.test(content) ||
    /사연|풀이|답글|1:1|개인\s*질문|상황/i.test(content) ||
    /같이\s*(보|봐)/i.test(content)
  );
}

export function hasFortuneOverclaim(content: string): boolean {
  return (
    /100%|확실|무조건|반드시|미래가\s*확정/i.test(content) ||
    /운명이\s*정해진/i.test(content)
  );
}
