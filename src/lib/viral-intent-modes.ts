import { isNewYearModeId, type NewYearModeId } from "@/lib/new-year/new-year-season";

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
  | "relationship_tension"
  | "beginner_qa"
  | "winner_replay"
  | NewYearModeId;

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
  | "missing_relationship_contrast"
  | "missing_beginner_question";

export interface ViralModeFidelityResult {
  readonly pass: boolean;
  readonly failureCodes: readonly ViralModeFidelityFailureCode[];
}

export const FORMAL_TONE_PATTERN = /(?:습니다|합니다|됩니다|입니다|하세요|십시오|인가요|셨나요|바랍니다)/;
// "A가 아니라 B" and "A일 뿐, 정작 B" count as comparisons: with "보다 센" banned as a template, drafts rank concepts this way.
const HIERARCHY_PATTERN = /보다\s*센|보다|아니라|아니고|아님|뿐|정작|(?:^|\s)vs(?:\s|$)|[<>＜＞]/gi;
export const IDENTITY_MARKER_PATTERN = /화개살?|도화살?|홍염살?|문창귀인|천을귀인|진술축미|(?:신금|경금|갑목|을목|병화|정화|무토|기토|임수|계수)\s*(?:일주|타입)/;
const RELATIONSHIP_PATTERN = /연애|궁합|애인|남친|여친|헤어|손절|관계|재회|전남친|전여친|썸|고백|설렘|결혼|이별|연락/;
const RELATIONSHIP_CONTRAST_PATTERN = /절대|vs|대비|만나면|헤어지|망|놓치|파멸|귀인|원진|상극|보다|아니라|아니고|아님/;

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

export interface ViralFidelityOptions {
  identityMarkers?: string[];
  formalTonePattern?: RegExp;
  isEnglish?: boolean;
}

export function checkViralModeFidelity(
  content: string,
  modeId: ViralIntentModeId,
  options?: ViralFidelityOptions
): ViralModeFidelityResult {
  const failureCodes: ViralModeFidelityFailureCode[] = [];
  const opening = extractOpeningLines(content, 2);

  const isEnglish = options?.isEnglish ?? false;
  const formalPattern = options?.formalTonePattern ?? (isEnglish ? null : FORMAL_TONE_PATTERN);

  if (formalPattern && formalPattern.test(content)) {
    failureCodes.push("formal_tone");
  }

  if (modeId === "imagination_dilemma" && !hasThreeNumberedChoices(content)) {
    failureCodes.push("missing_three_choices");
  }

  const hierarchyPattern = isEnglish
    ? /better than|worse than|(?:^|\s)vs(?:\s|$)|[<>＜＞]|higher than|over/gi
    : HIERARCHY_PATTERN;

  // One comparison is enough; demanding two produced the same "X보다 센 건 Y고, Y보다 센 건 Z" opener every time.
  if (modeId === "concept_hierarchy" && (opening.match(hierarchyPattern)?.length ?? 0) < 1) {
    failureCodes.push("missing_hierarchy");
  }

  let identityMatches = false;
  if (options?.identityMarkers && options.identityMarkers.length > 0) {
    const customPattern = new RegExp(options.identityMarkers.join("|"), "i");
    identityMatches = customPattern.test(opening);
  } else {
    identityMatches = IDENTITY_MARKER_PATTERN.test(opening);
  }

  if (modeId === "identity_profile" && !identityMatches) {
    failureCodes.push("missing_identity_marker");
  }

  const relPattern = isEnglish
    ? /dating|relationship|partner|ex|breakup|toxic|chemistry/i
    : RELATIONSHIP_PATTERN;
  const relContrastPattern = isEnglish
    ? /never|vs|clash|ruin|drain|contrast|karmic/i
    : RELATIONSHIP_CONTRAST_PATTERN;

  if (
    modeId === "relationship_tension"
    && (!relPattern.test(opening) || !relContrastPattern.test(opening))
  ) {
    failureCodes.push("missing_relationship_contrast");
  }

  if (modeId === "beginner_qa" && !/[?？]/.test(opening)) {
    failureCodes.push("missing_beginner_question");
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
    instruction: "친구·동료 사이에서 누구나 한 번쯤 본 흔한 장면을 관찰하듯 묘사해 훅을 열고, 공감과 함께 댓글로 참여하게 만든다.",
    rules: [
      "옆에서 본 장면처럼 날것의 대화체(반말/독백체)로 쓰되, 지어낸 1인칭 경험담('나도 ~했음')은 쓰지 않는다.",
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
    instruction: "사람들이 먼저 보는 것(A)보다 먼저 봐야 할 것(B)을 쉬운 말로 비교해 통념을 깨고, 극단적 1줄 앵커로 저장과 인게이지먼트를 유도한다.",
    rules: [
      "A보다 먼저 봐야 할 B처럼 판단 순서를 첫 두 줄 안에서 '~보다'로 비교한다. 사주 개념은 근거로 1개까지만 쓰고 쉬운 말로 풀어서 쓴다. 최근 글에 쓰인 비교 문장 틀은 반복하지 않는다.",
      "근거 없는 미신이나 공포 조장 금지. 결정론적/구조적 프레임으로 설명.",
      "본문 내 직접 링크 노출 금지.",
      "단순 A/B/C 자가분류 댓글 강요 금지.",
      "첫 댓글: 독자가 자기 경험으로 답할 수 있는 질문 한 줄. 링크·홍보 문구는 넣지 않는다.",
    ],
  },
  {
    id: "imagination_dilemma",
    label: "초저마찰 3지선다 딜레마 (30만 뷰 1등 검증)",
    primaryMetric: "replies",
    instruction: "극단적 상황이나 상상(로또 1등, 카드값, 퇴사 딜레마 등)을 날것의 구어로 던지고 1초 만에 1/2/3 선택지를 고르게 만들어 댓글 폭발을 유도한다.",
    rules: [
      "도입부는 '자, 상상해봐', '만약 ~라면' 같이 1초 안에 머릿속 시뮬레이션이 도는 상황 제시로 시작한다 (같은 문장 반복은 최근 글 회피 규칙이 잡는다).",
      "1초 만에 선택 가능한 직관적이고 극단적인 3개 번호 선택지를 제시한다.",
      "구구절절한 설명 문장을 배제하고 선택지만 명확히 남겨 댓글 참여 마찰력을 최소화한다.",
      "첫 댓글: 각 선택지를 고른 이유를 묻는 한 줄로 쓴다. 링크·홍보 문구는 넣지 않는다.",
    ],
  },
  {
    id: "identity_profile",
    label: "특정 기질/살/일주 프로파일링 (2.2만 뷰 3등 검증)",
    primaryMetric: "saves",
    instruction: "사주에 '진술축미', '화개살', '문창귀인'이 있거나 '신금/경금' 일주인 사람들의 숨겨진 강점과 맹점을 팩폭으로 프로파일링하여 강한 자기 투사와 저장을 유도한다.",
    rules: [
      "첫 줄은 사주를 몰라도 읽히는 행동이나 상황으로 쓰고, 둘째 줄에서 그 기질의 근거로 특정 글자·살·일주(예: 화개살, 신금 일주)를 하나 호명하고 바로 쉬운 말로 푼다.",
      "두루뭉술한 위로 대신 날카로운 양면성(치명적 무기 vs 발목 잡는 덫)을 짚는다.",
      "본문 링크 금지.",
      "번호 선택지를 쓰지 않고, 독자에게 직접 묻는 한 문장으로 끝낸다.",
      "첫 댓글: 독자가 자기 경험으로 답할 수 있는 질문 한 줄. 독자의 일주나 살을 묻지 않는다. 링크·홍보 문구는 넣지 않는다.",
    ],
  },
  {
    id: "relationship_tension",
    label: "관계 손절 및 궁합 텐션 팩폭 (2.3만 뷰 4등 검증)",
    primaryMetric: "shares",
    instruction: "절대 헤어지면 안 되는 궁합 vs 만나면 파멸하는 궁합, 또는 전남친/손절 타이밍을 팩트로 분석하여 독자의 깊은 공감과 공유/댓글을 이끌어낸다.",
    rules: [
      "첫 두 줄 안에 관계 단어(연애·궁합·연락·헤어짐 등)와 대비(만나면/헤어지면, '~보다', 파멸·놓치)를 함께 쓴다.",
      "감정적 연애 상담이 아니라 구조적 기질 궁합의 충돌 원리를 설명한다.",
      "단정적 미래 확정 대신 리스크 헷징 관점을 제시한다.",
      "번호 선택지를 쓰지 않고, 독자에게 직접 묻는 한 문장으로 끝낸다.",
      "첫 댓글: 상대와 지금 어떤 상황인지 묻는 한 줄로 쓴다. 링크·홍보 문구는 넣지 않는다.",
    ],
  },
  {
    id: "beginner_qa",
    label: "사주 입문자 질문 풀이",
    primaryMetric: "replies",
    instruction: "사주를 처음 보는 사람이 실제로 묻는 질문 하나를 첫 줄에 그대로 던지고, 짧고 쉽게 풀어준다.",
    rules: [
      "첫 줄은 입문자가 진짜 할 법한 질문 한 문장이다. 예: 태어난 시간 모르면 사주 못 봐? / 양력 음력 뭘로 넣어? / 대운이 뭔데?",
      "답은 결론 먼저 한 줄, 이유는 사주 용어 1개를 쉬운 말로 풀어서 짧게 쓴다.",
      "겁주거나 '모르면 큰일' 식으로 불안을 팔지 않는다.",
      "번호 선택지를 쓰지 않고, 독자가 비슷하게 헷갈렸던 걸 묻는 한 문장으로 끝낸다.",
      "첫 댓글: 다음엔 뭐가 궁금한지 가볍게 묻는 한 줄로 쓴다. 답글 약속, 링크·홍보 문구는 넣지 않는다.",
    ],
  },
];

// Rewrites the structure of one of the brand's own high-view posts with a new topic. Kept out of
// VIRAL_INTENT_MODES so index rotation is unchanged; the lean selector offers it only when a source exists.
export const WINNER_REPLAY_MODE: ViralIntentMode = {
  id: "winner_replay",
  label: "승자 재현",
  primaryMetric: "shares",
  instruction: "아래 참고 글의 구조(첫 줄 방식, 줄 구성, 마무리 방식)만 따라 새 글을 쓴다. 주제·문장·표현은 그대로 쓰지 않는다.",
  rules: [
    "참고 글의 문장이나 표현을 그대로 옮기지 않는다.",
    "주제는 이번 글의 [주제]에서 가져온다.",
  ],
};

// 2027 New Year slot modes. Like WINNER_REPLAY_MODE they stay out of VIRAL_INTENT_MODES so index rotation
// is unchanged; the generation loop assigns them by season slot. Saju values come from the brief, never the LLM.
export const NEW_YEAR_MODES: Record<NewYearModeId, ViralIntentMode> = {
  ny_ranking: {
    id: "ny_ranking",
    label: "2027 일간별 분류",
    primaryMetric: "shares",
    instruction: "2027년에 일간별로 바빠지는 영역이 다르다는 걸, [자료]의 5개 결로 10개 일간을 묶은 분류표처럼 보여준다. 순위나 점수가 아니라 분류다.",
    rules: [
      "[자료]에 적힌 결과 일간 묶음만 쓴다. 일간을 다른 결로 옮기거나 새 결을 만들지 않는다.",
      "TOP N, 1위, 점수, 퍼센트 같은 순위·수치 표현을 쓰지 않는다.",
      "첫 줄은 일간 이름 없이 '2027년엔 사람마다 바쁜 데가 다르다'는 한 줄로 쓴다. 일간 이름은 둘째 줄부터 나온다.",
      "한 줄에 같은 결의 일간만 묶는다. 예: 갑목·을목: (그 결의 한 줄 설명)",
      "일간은 태어난 날의 천간이라는 풀이를 한 번만 짧게 붙인다.",
      "'~하기 쉬운' 수준으로만 쓰고 확정 예언('반드시', '무조건')은 쓰지 않는다. 지어낸 경험담도 쓰지 않는다.",
      "본문에 링크를 넣지 않는다. 첫 댓글에 샘플 링크가 자동으로 붙는다.",
    ],
  },
  ny_ipchun: {
    id: "ny_ipchun",
    label: "입춘 반전",
    primaryMetric: "shares",
    instruction: "사주의 해는 1월 1일이 아니라 입춘부터 바뀐다는 반전을 쉬운 말로 푼다. 1월에 보는 신년운세가 사실 지난해 흐름일 수 있다는 점이 핵심이다.",
    rules: [
      "첫 줄은 '1월에 보는 신년운세, 사실 작년 흐름일 수 있어' 같은 반전 한 문장이다. 사주 용어 전제 없이 쓴다.",
      "입춘 날짜와 시각은 [자료]의 값만 쓴다. 다른 날짜나 시각을 지어내지 않는다.",
      "입춘 전에 태어난 사람은 사주에서 전년생으로 본다는 사실을 쉬운 말로 한 번 설명한다.",
      "'~하기 쉬운' 수준으로만 쓰고 확정 예언은 쓰지 않는다. 지어낸 경험담도 쓰지 않는다.",
      "본문에 링크를 넣지 않는다. 첫 댓글에 샘플 링크가 자동으로 붙는다.",
    ],
  },
  ny_monthly: {
    id: "ny_monthly",
    label: "2027 월별 흐름표",
    primaryMetric: "saves",
    instruction: "2027년 1~12월 월주를 한 줄에 한 달씩 순서대로 정리해, 저장해 두고 달이 바뀔 때 꺼내 보는 달력형 글로 쓴다.",
    rules: [
      "[자료]의 12개 월주를 글자 그대로 순서대로 쓴다. 월주를 바꾸거나 빼지 않는다.",
      "1월은 아직 2026년 병오해의 흐름이고 입춘(2월)부터 2027년 사주의 해라는 점을 한 번만 짚는다.",
      "달마다 한 줄 이내로 '~하기 쉬운' 수준의 분위기만 쓴다. 확정 예언과 지어낸 숫자는 쓰지 않는다.",
      "마지막에 저장해 두고 달이 바뀔 때 다시 보라는 한 줄을 붙인다.",
      "본문에 링크를 넣지 않는다. 첫 댓글에 샘플 링크가 자동으로 붙는다.",
    ],
  },
  ny_pick: {
    id: "ny_pick",
    label: "2027 사람·일·돈 고르기",
    primaryMetric: "replies",
    instruction: "2027년에 가장 신경 쓰일 것 하나를 사람/일/돈 중에서 고르게 하고, 번호 선택지로 끝낸다.",
    rules: [
      "첫 줄은 '2027년, 제일 신경 쓰일 건?' 같은 질문이다. 일간이나 사주 용어를 전제하지 않는다.",
      "선택지는 1. 사람 2. 일 3. 돈 세 개이고, 한 줄 설명은 [자료]의 결 설명만 쓴다.",
      "번호 선택지로 글을 끝낸다. 번호 하나만 답하면 되게 쓰고, 댓글로 풀이해 주겠다는 약속은 쓰지 않는다.",
      "'~하기 쉬운' 수준으로만 쓰고 확정 예언은 쓰지 않는다. 지어낸 경험담도 쓰지 않는다.",
      "본문에 링크를 넣지 않는다. 첫 댓글에 샘플 링크가 자동으로 붙는다.",
    ],
  },
  ny_zodiac: {
    id: "ny_zodiac",
    label: "2027 띠별 콕 집기",
    primaryMetric: "shares",
    instruction: "[자료]의 주제 하나와 그 주제의 띠만 출생년도와 함께 콕 집어, 독자가 자기 띠를 찾게 한다.",
    rules: [
      "첫 줄은 띠 이름 없이 [자료]의 주제를 단언하는 한 줄로 쓴다. 띠 이름은 둘째 줄부터 나온다.",
      "띠마다 한 줄, 번호 없이 '돼지띠 (95·83·71·07년생): …'처럼 쓴다. [자료]에 있는 띠와 출생년도만 쓰고 다른 띠나 연도를 지어내지 않는다.",
      "입춘부터 띠를 바꿔 본다는 안내를 '~일 수 있어'로 한 줄 쓴다.",
      "'사주'나 '운세'라는 말을 한 번 넣는다.",
      "삼합·육합 같은 용어와 1위, TOP, 순위 같은 순위 표현은 쓰지 않는다.",
      "'~하기 쉬운' 수준으로만 쓰고 확정 예언은 쓰지 않는다. 지어낸 경험담도 쓰지 않는다.",
      "마무리 한 줄로 저장하거나 가족·친구 띠도 찾아 공유하라고 권한다.",
      "본문에 링크를 넣지 않는다. 첫 댓글에 샘플 링크가 자동으로 붙는다.",
    ],
  },
};

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
  trend_correction: "quiet_contrarian",
  real_sign_boundary: "saveable_tool",
  identity_callout: "identity_profile",
  all_twelve_series: "saveable_tool",
  two_birthday_compatibility: "friend_share",
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
    input === "relationship_tension" ||
    input === "beginner_qa"
  ) {
    return input;
  }
  return typeof input === "string" ? LEGACY_FORMULA_MAP[input] ?? null : null;
}

/**
 * 15-Post Master Sprint Allocation (1,600 live posts ground truth):
 * - 4개: 29.9만 뷰 1등 imagination_dilemma (로또/현실 3지선다)
 * - 4개: 12.2만/4.0만/2.2만 뷰 2등 concept_hierarchy (도화vs홍염vs화개 서열)
 * - 3개: 2.2만/1.2만/1.1만 뷰 3등 identity_profile (화개살/문창귀인/신금일주)
 * - 3개: 2.3만/9천 뷰 4등 relationship_tension (궁합/손절/관계 타이밍)
 * - 1개: beginner_qa (입문자 질문 풀이, 아직 검증 전 — 학습 cron이 성과로 비중을 정한다)
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
  "beginner_qa",         // 15. 입문자 질문 풀이 (검증 전, 댓글 반응 테스트)
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

// Offer formulas live outside LEGACY_FORMULA_MAP on purpose: campaign normalization uses that map and would rename them.
const OFFER_FORMULA_MODES: Record<string, ViralIntentModeId> = {
  synastry_blueprint_offer: "relationship_tension",
  d2c_etsy_offer: "quiet_contrarian",
};

export function resolveViralIntentMode(formulaId: string | null, fallbackIndex: number): ViralIntentMode {
  if (formulaId === WINNER_REPLAY_MODE.id) return WINNER_REPLAY_MODE;
  if (isNewYearModeId(formulaId)) return NEW_YEAR_MODES[formulaId];
  const normalizedId = normalizeViralIntentModeId(formulaId)
    ?? (formulaId ? OFFER_FORMULA_MODES[formulaId] ?? null : null);
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
    instruction: "Structure as a checklist, scorecard, or sequence guide worth bookmarking; the formula sets how many rows.",
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
    instruction: "Open with a familiar real-life scene, described as an observation, that sparks immediate resonance.",
    rules: [
      "Write in a raw, conversational voice, but never invent a first-person story or confession.",
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
  beginner_qa: {
    label: "Beginner Question Answered",
    instruction: "Open with one question a first-time reader genuinely asks, then answer it briefly in plain words.",
    rules: [
      "The first line is the beginner's question itself, e.g. 'Can I get a reading without my birth time?'",
      "Lead with the answer, then explain with one or two terms in plain language.",
      "Never sell anxiety or imply something is wrong with the reader.",
      "Close by asking what else confused them, not with numbered choices.",
    ],
  },
  ny_ranking: {
    label: "2027 Day Master Grouping",
    instruction: "Show that different day masters get busy in different areas in 2027, grouping all 10 day masters into the 5 themes in the brief. A grouping, not a ranking or a score.",
    rules: [
      "Use only the themes and day master groups in the brief; never move a day master to another theme or invent a theme.",
      "No TOP N, no 'No. 1', no scores or percentages.",
      "The first line names no day master (just 'what keeps you busy in 2027 differs by person'); day master names start from the second line.",
      "Group only day masters of the same theme on one line.",
      "Explain once, briefly, that the day master is the heavenly stem of the birth day.",
      "Stay at the 'likely' level; no certainty and no invented personal stories.",
      "No link in the body; the sample link is added in the first comment.",
    ],
  },
  ny_ipchun: {
    label: "Lichun Twist",
    instruction: "Explain simply that the saju year turns at Lichun (start of spring), not on January 1, so a January 'new year reading' may describe last year's flow.",
    rules: [
      "The first line is the twist in one sentence, with no saju jargon assumed.",
      "Use only the Lichun date and time in the brief; never invent another date or time.",
      "Explain once that people born before Lichun count as the previous year's birth in saju.",
      "Stay at the 'likely' level; no certainty and no invented personal stories.",
      "No link in the body; the sample link is added in the first comment.",
    ],
  },
  ny_monthly: {
    label: "2027 Month-by-Month Chart",
    instruction: "List the 12 month pillars of 2027 in order, one line per month, as a calendar-style post worth saving and revisiting each month.",
    rules: [
      "Use the 12 month pillars in the brief exactly and in order; never change or skip one.",
      "Mention once that January still belongs to the 2026 Fire Horse year and the 2027 saju year starts at Lichun in February.",
      "One line or less per month, at the 'likely' level; no certainty and no invented numbers.",
      "End with one line telling readers to save it and come back when the month changes.",
      "No link in the body; the sample link is added in the first comment.",
    ],
  },
  ny_pick: {
    label: "2027 People / Work / Money Pick",
    instruction: "Ask which one will matter most in 2027 among people, work and money, and end with numbered choices.",
    rules: [
      "The first line is a question like 'What will matter most to you in 2027?' with no saju jargon assumed.",
      "Exactly three choices: 1. People 2. Work 3. Money, each described only with the theme text in the brief.",
      "End the post with the numbered choices; one number is enough, and never promise to reply with a reading.",
      "Stay at the 'likely' level; no certainty and no invented personal stories.",
      "No link in the body; the sample link is added in the first comment.",
    ],
  },
  ny_zodiac: {
    label: "2027 Zodiac Spotlight",
    instruction: "Pick out the one theme in the brief and only its zodiac signs, with their birth years, so readers can find their own sign.",
    rules: [
      "The first line is a plain statement of the theme, 60 characters or fewer, and names no zodiac sign. Sign names start from the second line.",
      "One line per sign, no numbering, like 'Pig (born 1971, 1983, 1995, 2007): ...'. Use only the signs and birth years in the brief; write years as 4 digits.",
      "Add one line, at the 'may' level, saying the zodiac year turns at Ipchun (Feb 4), so early-February birthdays may count as the year before. Write it as 'Ipchun'.",
      "Mention 'saju' once.",
      "No terms like trine or six harmonies, and no ranking words such as No. 1, TOP or rank.",
      "Stay at the 'likely' level; no certainty and no invented personal stories. You may introduce 2027 as the Year of the Fire Goat.",
      "End with one line telling readers to save it or share it with family and friends.",
      "No link in the body; the sample link is added in the first comment.",
    ],
  },
  winner_replay: {
    label: "Winner Replay",
    instruction: "Follow only the structure of the reference post below (opening move, line layout, closing move) and write a new post. Never reuse its topic, sentences or phrasing.",
    rules: [
      "Do not copy any sentence or phrase from the reference post.",
      "Take the topic from this post's [Topic].",
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

// 2026-10-22 metrics: posts ending in numbered choices had a median of 197 views vs 101, and posts ending in a
// question 182 vs 103. The gate deliberately does not require either (it collapsed every post into one
// template), so the share is raised by rotating the closing per post instead.
export type ClosingFormat = "choices" | "question" | "statement";

const CLOSING_FORMAT_ROTATION: readonly ClosingFormat[] = ["question", "statement", "question", "choices", "question", "statement"];

// choicesCapped: the numbered-choice template cap is already hit, so the gate would reject a numbered-choice ending.
export function pickClosingFormat(index: number, modeId?: ViralIntentModeId | null, choicesCapped = false): ClosingFormat {
  if (modeId === "imagination_dilemma") return "choices";
  const format = CLOSING_FORMAT_ROTATION[((index % CLOSING_FORMAT_ROTATION.length) + CLOSING_FORMAT_ROTATION.length) % CLOSING_FORMAT_ROTATION.length];
  return choicesCapped && format === "choices" ? "question" : format;
}

export const CLOSING_FORMAT_PROMPT_KO: Record<ClosingFormat, string> = {
  choices: "마지막은 1초 만에 고를 수 있는 번호 선택지 1/2/3으로 끝낸다. 선택지 뒤에 설명을 붙이지 않는다.",
  question: "마지막 문장은 독자 자신에게 되묻는 물음표(?)로 끝낸다. '어떻게 생각해?' 같은 범용 질문은 금지, 글 내용에서 나온 구체적인 질문 하나.",
  statement: "마지막은 질문이나 선택지 없이 뼈 때리는 단언 한 줄로 끝낸다.",
};
