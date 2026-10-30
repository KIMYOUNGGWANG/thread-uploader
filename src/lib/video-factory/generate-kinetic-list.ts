import Anthropic from "@anthropic-ai/sdk";
import { CLAUDE_TEXT_MODEL, readMessageText } from "@/lib/claude-text";
import {
  checkKineticListScript,
  forbiddenTermsFor,
  KINETIC_GLYPHS,
  type KineticListScript,
  type ScriptCheck,
} from "./kinetic-list-script";

export interface GenerateInput {
  brandName: string;
  qualityProfile: string;
  recentHooks: string[];
  kstDate: string;
}
/** 프롬프트를 받아 모델 응답 텍스트를 돌려준다. 테스트에서 주입한다. */
export type CreateMessage = (prompt: string) => Promise<string>;

const MAX_ATTEMPTS = 3;

const str = { type: "string" };
// 배열 개수 제약(minItems/maxItems)은 API가 지원하지 않는다. 개수는 프롬프트와 checkKineticListScript가 강제한다.
const pairSchema = { type: "array", items: str };
export const SCRIPT_SCHEMA = {
  type: "object",
  properties: {
    hook: {
      type: "object",
      properties: { kicker: str, lines: pairSchema },
      required: ["kicker", "lines"],
      additionalProperties: false,
    },
    intro: { type: "object", properties: { l1: str, l2: str }, required: ["l1", "l2"], additionalProperties: false },
    items: {
      type: "array",
      items: {
        type: "object",
        properties: { glyph: str, label: str, action: pairSchema },
        required: ["glyph", "label", "action"],
        additionalProperties: false,
      },
    },
    cta: { type: "object", properties: { l1: str, l2: str }, required: ["l1", "l2"], additionalProperties: false },
    captions: {
      type: "object",
      properties: { instagram: str, youtube: str, tiktok: str },
      required: ["instagram", "youtube", "tiktok"],
      additionalProperties: false,
    },
    hashtags: { type: "array", items: str },
  },
  required: ["hook", "intro", "items", "cta", "captions", "hashtags"],
  additionalProperties: false,
};

export const FALLBACK_SCRIPTS: KineticListScript[] = [
  {
    hook: { kicker: "11월", lines: ["이직 고민이면", "일간별로"] },
    intro: { l1: "딱 하나만", l2: "해보세요" },
    items: [
      { glyph: "丙", label: "병화", action: ["먼저 연락하기", "오늘 안에 한 통"] },
      { glyph: "壬", label: "임수", action: ["이력서 한 줄", "지금 고쳐 쓰기"] },
      { glyph: "己", label: "기토", action: ["지원할 곳 3개", "목록으로 적기"] },
    ],
    cta: { l1: "내 일간 모르면", l2: "프로필 링크 → 1분" },
    captions: {
      instagram: "이직 고민 중이면 일간별로 딱 하나만. 내 일간은 프로필 링크에서 1분이면 확인해요.",
      youtube: "이직 고민 중이면 일간별로 딱 하나만 해보세요. 내 일간은 프로필 링크에서 확인.",
      tiktok: "이직 고민 중이면 일간별로 딱 하나만. 내 일간 확인은 프로필 링크!",
    },
    hashtags: ["사주", "일간", "이직", "cosmicpath"],
  },
  {
    hook: { kicker: "이번 주", lines: ["마음이 복잡하면", "일간별로"] },
    intro: { l1: "오늘은", l2: "이것만" },
    items: [
      { glyph: "甲", label: "갑목", action: ["산책 20분 걷기", "휴대폰 두고 나가기"] },
      { glyph: "庚", label: "경금", action: ["책상 위 정리", "서랍 하나 비우기"] },
      { glyph: "癸", label: "계수", action: ["생각 종이에 적기", "세 줄만 쓰기"] },
    ],
    cta: { l1: "내 일간 모르면", l2: "프로필 링크 → 1분" },
    captions: {
      instagram: "마음이 복잡한 날, 일간별로 하나만 해봐요. 내 일간은 프로필 링크에서 1분이면 확인해요.",
      youtube: "마음이 복잡할 때 일간별로 하나씩. 내 일간은 프로필 링크에서 확인하세요.",
      tiktok: "마음이 복잡하면 일간별로 하나만! 내 일간은 프로필 링크에서.",
    },
    hashtags: ["사주", "일간", "일상루틴", "cosmicpath"],
  },
];

function dayIndex(kstDate: string): number {
  return Math.floor(Date.parse(kstDate) / 86_400_000);
}

function buildPrompt(input: GenerateInput, forbidden: string[], previousErrors: string[]): string {
  const lines = [
    `${input.brandName} 사주 숏폼 영상의 10초 키네틱 리스트 원고를 JSON으로 만들어줘.`,
    "형식: 훅 → 인트로 → 일간 3개(한자 글리프 + 이름 + 행동 2줄) → CTA.",
    "",
    "글자 수 상한 (공백 포함, 넘으면 무효라 줄여 쓰는 게 아니라 처음부터 맞춰 써야 해):",
    "- hook.kicker 6자 이하",
    "- hook.lines 정확히 2줄, 각 8자 이하",
    "- intro.l1, intro.l2 각 6자 이하",
    "- items 정확히 3개. label 4자 이하, action 정확히 2줄 각 10자 이하",
    "- cta.l1 10자 이하, cta.l2 12자 이하",
    `- glyph는 ${[...KINETIC_GLYPHS].join("")} 중 한 글자`,
    "",
    "톤 규칙:",
    "- 행동 문장으로 쓴다 (예: 먼저 연락하기). 예언 금지: 올해 대박, 반드시 ~된다 같은 단정은 쓰지 않는다.",
    '- CTA는 프로필 링크로 유도한다. "DM", "댓글 달면" 같은 표현은 금지.',
    `- 금지어 (어디에도 쓰지 마): ${forbidden.join(", ") || "없음"}`,
    `- 오늘 날짜: ${input.kstDate}. 시기에 맞는 소재를 고른다.`,
  ];
  if (input.recentHooks.length > 0) {
    lines.push("", "최근 훅 (겹치지 말 것):", ...input.recentHooks.map((h) => `- ${h}`));
  }
  if (previousErrors.length > 0) {
    lines.push("", "직전 시도가 아래 검사에서 실패했어. 전부 고쳐서 다시 써줘:", ...previousErrors.map((e) => `- ${e}`));
  }
  lines.push(
    "",
    "JSON만 출력해. 스키마:",
    JSON.stringify(SCRIPT_SCHEMA),
    "captions는 instagram/youtube/tiktok 각 1~2문장, hashtags는 # 없이 단어만.",
  );
  return lines.join("\n");
}

function defaultCreateMessage(apiKey: string): CreateMessage {
  const client = new Anthropic({ apiKey, timeout: 30_000, maxRetries: 1 });
  return async (prompt) =>
    readMessageText(
      await client.messages.create({
        model: CLAUDE_TEXT_MODEL,
        max_tokens: 1500,
        output_config: { format: { type: "json_schema", schema: SCRIPT_SCHEMA } },
        messages: [{ role: "user", content: prompt }],
      }),
    );
}

/** 모델 응답에서 첫 `{`부터 마지막 `}`까지 파싱. 실패하면 null. */
function parseJsonObject(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

/** 원고를 만들고 검사를 통과할 때까지 최대 3회 시도한다. 키가 없으면 고정 대체 원고(로컬·데모용). */
export async function generateKineticListScript(input: GenerateInput, createMessage?: CreateMessage): Promise<ScriptCheck> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const create = createMessage ?? (apiKey ? defaultCreateMessage(apiKey) : null);
  if (!create) return { ok: true, script: FALLBACK_SCRIPTS[dayIndex(input.kstDate) % FALLBACK_SCRIPTS.length] };

  const forbidden = forbiddenTermsFor(input.qualityProfile);
  let errors: string[] = [];
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const parsed = parseJsonObject(await create(buildPrompt(input, forbidden, errors)));
    const check: ScriptCheck =
      parsed === null ? { ok: false, errors: ["응답: JSON을 읽을 수 없음"] } : checkKineticListScript(parsed, forbidden);
    if (check.ok) return check;
    errors = check.errors;
  }
  return { ok: false, errors };
}
