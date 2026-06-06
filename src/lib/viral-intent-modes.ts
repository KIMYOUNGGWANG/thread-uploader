export type ViralIntentModeId =
  | "self_classification"
  | "saveable_tool"
  | "quiet_contrarian"
  | "friend_share";

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
    instruction: "흔한 운세 믿음을 차분하게 뒤집고 CosmicPath 관점으로 연결한다.",
    rules: [
      "불안을 찌르지 않고 잘못된 질문 구조를 짚는다.",
      "상대 마음 보장이나 100% 예측 표현 금지.",
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
      "놀림이나 공포 자극 없이 공감 중심으로 쓴다.",
      "공유 후에도 운영자 답글이 필요 없는 구조로 쓴다.",
    ],
  },
];

const SPRINT_GROUP_SIZE = 7;
const LEGACY_FORMULA_MAP: Record<string, ViralIntentModeId> = {
  comment_diagnosis: "self_classification",
  friend_tag: "friend_share",
  self_confession: "quiet_contrarian",
};

export function normalizeViralIntentModeId(input: unknown): ViralIntentModeId | null {
  if (input === "self_classification" || input === "saveable_tool" || input === "quiet_contrarian" || input === "friend_share") {
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
  return /A\s*[./)]|A\s*\/\s*B|A\.\s*|B\.\s*|C\.\s*/i.test(content)
    || /(연락|움직임|확장)\s*\/\s*(대기|보수)\s*\/\s*(축소|정리)\s*\/\s*보류/.test(content)
    || /버팀형[\s\S]*(이동형|준비형)/.test(content)
    || /(가까운\s*쪽|하나만|어느\s*쪽|중\s*하나).*(골라|체크|표시|기억)/.test(content);
}

export function hasSaveShareMechanic(content: string): boolean {
  return /(저장|캡처|체크리스트|판정표|순서표|다시\s*봐|보내줘|공유|친구)/.test(content);
}

export function hasLowTouchEngagementMechanic(content: string): boolean {
  return hasSelfClassificationMechanic(content)
    || hasSaveShareMechanic(content)
    || /(프로필|링크|랜딩|확인|신청|가입)/.test(content);
}

export function hasReplyBurdenPromise(content: string): boolean {
  return /(댓글|답글|답장|DM|디엠|달아줘|남겨|남기면|써줘|적어|봐줄게|봐드릴게|알려줄게|진단해줄게|풀이해줄게|사연.*(접수|남겨|써|적어)|질문.*(접수|남겨|써|적어)|상황.*(남겨|남기|써줘|써|적어)|(같이|함께).*(보자|볼게|봐|볼\s*수|봐줄|봐\s*줄|봐드릴|검토|진단)|(A\/B\/C|버팀형|이동형|준비형).*(뭐가|어디였|어디에|고른\s*사람|뭐\s*골랐|어느\s*쪽이야))/.test(content);
}

export function hasFortuneOverclaim(content: string): boolean {
  return /(100%\s*맞|100%\s*알|상대\s*마음.*알려|미래.*보장|운명.*예측|무조건\s*(연락|헤어|된다|성공)|확실히\s*(된다|안\s*된다))/.test(content);
}
