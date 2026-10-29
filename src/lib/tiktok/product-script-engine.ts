// Short-form scripts for non-saju brands, written from the brand's productProfile.
// Same four beats and timings as the saju explainer; scene 3 is a kinetic card instead of a saju chart.
import Anthropic from "@anthropic-ai/sdk";
import { CLAUDE_TEXT_MODEL, readMessageText } from "@/lib/claude-text";
import type { DomainPresetConfig } from "@/lib/domain-registry";
import type { ProductProfile } from "@/types/brand";
import { isRecord } from "@/types/config-normalizers";
import {
  HOOK_MAX_CHARS,
  OVERPROMISE_PATTERN,
  type ExplainerQuality,
  type ScriptGenerationParams,
  type ScriptLang,
  type TikTokSceneBeat,
  type TikTokScriptResult,
} from "./tiktok-script-engine";

// Preset forbidden lists don't all carry these (career_decision has no "사주"), so every product script checks them.
export const SAJU_TERMS: readonly string[] = ["사주", "일간", "명식", "대운", "운세", "신살", "saju", "day master", "bazi"];
const UNTITLED_PRODUCT = "Untitled Product";

export interface ProductScriptParams {
  brandName: string;
  productProfile: ProductProfile;
  preset: Pick<DomainPresetConfig, "name" | "description" | "forbiddenCrossDomainTerms">;
  topic: string;
  tone?: ScriptGenerationParams["tone"];
  lang?: ScriptLang;
}

export interface ProductScriptCopy {
  hookText: string;
  hookSpoken: string;
  answerSpoken: string;
  answerScreen: string;
  proofSpoken: string;
  proofScreen: string[];
  ctaSpoken: string;
  ctaScreen: string;
  hashtags: string[];
}

export function resolveProductName(brandName: string, profile: ProductProfile): string {
  const name = profile.productName.trim();
  return name && name !== UNTITLED_PRODUCT ? name : brandName;
}

function forbiddenTerms(params: ProductScriptParams): string[] {
  return [...params.preset.forbiddenCrossDomainTerms, ...SAJU_TERMS];
}

function hashtag(text: string): string {
  return text.replace(/[\s#]/g, "");
}

// Deterministic copy for when no API key is set. Empty profile fields fall back to the preset description.
export function buildProductCopyLocally(params: ProductScriptParams): ProductScriptCopy {
  const { productProfile: profile, topic, lang = "ko" } = params;
  const name = resolveProductName(params.brandName, profile);
  const what = profile.oneLineDescription || params.preset.description;
  const promise = profile.offerPromise || params.preset.description;
  const customer = profile.targetCustomer;
  const hashtags = [hashtag(name), hashtag(params.brandName)].filter(
    (tag, index, tags) => tags.findIndex((other) => other.toLowerCase() === tag.toLowerCase()) === index
  );

  if (lang === "en") {
    const topicHook = `${topic} — why?`;
    return {
      hookText: topicHook.length <= HOOK_MAX_CHARS.en ? topicHook : `Why ${customer || "busy people"} never get time back?`,
      hookSpoken: `${topic}. There's a reason.`,
      answerSpoken: `The answer is ${name}. ${what}.`,
      answerScreen: name,
      proofSpoken: `What it does: ${promise}.`,
      proofScreen: [promise],
      ctaSpoken: `Try ${name} from the link in bio.`,
      ctaScreen: "Link in bio → try it",
      hashtags,
    };
  }

  const topicHook = `${topic}, 왜 그럴까?`;
  return {
    hookText: topicHook.length <= HOOK_MAX_CHARS.ko ? topicHook : `${customer || "바쁜 사람"} 일이 안 줄어드는 이유?`,
    hookSpoken: `${topic}. 이유가 따로 있어요.`,
    answerSpoken: `답은 ${name}. ${what}.`,
    answerScreen: name,
    proofSpoken: `핵심은 이거예요. ${promise}.`,
    proofScreen: [promise],
    ctaSpoken: `${name}, 프로필 링크에서 바로 써볼 수 있어요.`,
    ctaScreen: "프로필 링크에서 시작하기",
    hashtags,
  };
}

export function evaluateProductQuality(
  script: Pick<TikTokScriptResult, "scenes" | "totalDurationSeconds">,
  productName: string,
  forbidden: readonly string[],
  lang: ScriptLang = "ko"
): ExplainerQuality {
  const hook = script.scenes[0]?.onScreenText[0] ?? "";
  const payoff = script.scenes[1]?.spokenLine ?? "";
  const allText = script.scenes.flatMap((scene) => [scene.spokenLine, ...scene.onScreenText]).join(" ");
  const lowerText = allText.toLowerCase();
  const overpromise = allText.match(OVERPROMISE_PATTERN)?.[0];
  const leaked = forbidden.find((term) => lowerText.includes(term.toLowerCase()));
  const maxChars = HOOK_MAX_CHARS[lang];

  const checks: [boolean, string][] = [
    [/이유|\?|why/i.test(hook), "훅이 질문을 열지 않음 (Pull)"],
    [hook.length <= maxChars, `훅이 ${maxChars}자를 넘어 첫 장면에 다 안 읽힘 (Pull)`],
    [payoff.includes(productName), `훅의 답(제품명 "${productName}")이 바로 다음 장면에 없음 (Truth)`],
    [!overpromise, `과장·막연한 떡밥 문구: "${overpromise}" (Truth)`],
    [!leaked, `이 브랜드에 맞지 않는 용어: "${leaked}"`],
    [script.totalDurationSeconds >= 15 && script.totalDurationSeconds <= 30, "길이가 15~30초를 벗어남"],
  ];

  const qualityReasons = checks.filter(([ok]) => !ok).map(([, reason]) => reason);
  return {
    qualityScore: Math.round((100 * (checks.length - qualityReasons.length)) / checks.length),
    qualityPass: qualityReasons.length === 0,
    qualityReasons,
  };
}

export function assembleProductScript(copy: ProductScriptCopy, params: ProductScriptParams): TikTokScriptResult {
  const name = resolveProductName(params.brandName, params.productProfile);
  const lang = params.lang ?? "ko";
  const scenes: TikTokSceneBeat[] = [
    {
      sceneId: "scene-01-hook",
      durationSeconds: 3.5,
      type: "kinetic-card",
      spokenLine: copy.hookSpoken,
      onScreenText: [copy.hookText],
      visualProps: { hookText: copy.hookText, subText: name, badge: name, colorScheme: params.tone === "urgent" ? "fire-red" : "electric-purple" },
    },
    { sceneId: "scene-02-answer", durationSeconds: 5.5, type: "placeholder", spokenLine: copy.answerSpoken, onScreenText: [copy.answerScreen], visualProps: { hookText: copy.answerScreen } },
    {
      sceneId: "scene-03-proof",
      durationSeconds: 7.0,
      type: "kinetic-card",
      spokenLine: copy.proofSpoken,
      onScreenText: copy.proofScreen,
      visualProps: { hookText: copy.proofScreen[0] ?? name, subText: copy.proofScreen[1], badge: name, colorScheme: "electric-purple" },
    },
    {
      sceneId: "scene-04-cta",
      durationSeconds: 4.0,
      type: "kinetic-card",
      spokenLine: copy.ctaSpoken,
      onScreenText: [copy.ctaScreen],
      visualProps: { hookText: copy.ctaScreen, subText: name, badge: `✨ ${name}`, colorScheme: "neon-yellow" },
    },
  ];
  const totalDurationSeconds = scenes.reduce((acc, s) => acc + s.durationSeconds, 0);

  return {
    title: `${name}: ${copy.hookText}`,
    spokenHook: copy.hookSpoken,
    fullScript: scenes.map((s) => s.spokenLine).join(" "),
    totalDurationSeconds,
    scenes,
    cta: copy.ctaScreen,
    hashtags: copy.hashtags,
    ...evaluateProductQuality({ scenes, totalDurationSeconds }, name, forbiddenTerms(params), lang),
  };
}

/** Claude writes the copy when the key is set, the local template otherwise. Claude errors surface as-is. */
export async function generateProductScript(params: ProductScriptParams): Promise<TikTokScriptResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return assembleProductScript(buildProductCopyLocally(params), params);

  const client = new Anthropic({ apiKey, timeout: 30_000, maxRetries: 1 });
  const message = await client.messages.create({
    model: CLAUDE_TEXT_MODEL,
    max_tokens: 1500,
    output_config: { format: { type: "json_schema", schema: COPY_SCHEMA } },
    messages: [{ role: "user", content: buildPrompt(params) }],
  });
  const copy = parseCopy(JSON.parse(readMessageText(message)));
  if (!copy) throw new Error("대본 응답을 읽을 수 없습니다");
  return assembleProductScript(copy, params);
}

const STRING_FIELDS = ["hookText", "hookSpoken", "answerSpoken", "answerScreen", "proofSpoken", "ctaSpoken", "ctaScreen"] as const;
const LIST_FIELDS = ["proofScreen", "hashtags"] as const;

const COPY_SCHEMA = {
  type: "object",
  properties: {
    ...Object.fromEntries(STRING_FIELDS.map((field) => [field, { type: "string" }])),
    ...Object.fromEntries(LIST_FIELDS.map((field) => [field, { type: "array", items: { type: "string" } }])),
  },
  required: [...STRING_FIELDS, ...LIST_FIELDS],
  additionalProperties: false,
};

function isStringList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function parseCopy(raw: unknown): ProductScriptCopy | null {
  if (!isRecord(raw)) return null;
  if (!STRING_FIELDS.every((field) => typeof raw[field] === "string")) return null;
  if (!LIST_FIELDS.every((field) => isStringList(raw[field]))) return null;
  return raw as unknown as ProductScriptCopy;
}

function buildPrompt(params: ProductScriptParams): string {
  const { productProfile: profile, lang = "ko" } = params;
  const name = resolveProductName(params.brandName, profile);
  const facts = [
    `제품명: ${name}`,
    profile.oneLineDescription && `한 줄 설명: ${profile.oneLineDescription}`,
    profile.targetCustomer && `대상 고객: ${profile.targetCustomer}`,
    profile.offerPromise && `약속: ${profile.offerPromise}`,
    profile.positioningNotes && `포지셔닝: ${profile.positioningNotes}`,
    `업종: ${params.preset.name} — ${params.preset.description}`,
  ].filter(Boolean);
  const tone = { mysterious: "궁금증을 남기는", urgent: "지금 바로 손해를 막아야 하는", encouraging: "따뜻하게 격려하는" }[params.tone ?? "mysterious"];

  return [
    `TikTok 9:16 숏폼(20초, 4장면) 대본을 ${lang === "en" ? "영어(English)" : "한국어"}로 써줘.`,
    "",
    ...facts,
    `주제: ${params.topic}`,
    `톤: ${tone}`,
    "",
    "장면 역할:",
    `1. 훅(hookText 화면 문구, hookSpoken 음성): 대상 고객이 겪는 문제를 "왜?"로 묻는 질문. hookText는 물음표로 끝나고 ${HOOK_MAX_CHARS[lang]}자 이내.`,
    `2. 답(answerSpoken, answerScreen): 훅의 답. answerSpoken에 제품명 "${name}"을 그대로 넣는다.`,
    "3. 근거(proofSpoken, proofScreen 1~2줄): 제품이 그 문제를 푸는 방식이나 약속 한 가지. 지어낸 수치는 쓰지 않는다.",
    "4. CTA(ctaSpoken, ctaScreen): 프로필 링크로 유도.",
    "hashtags: # 없이 3~5개.",
    "",
    `쓰면 안 되는 단어: ${forbiddenTerms(params).join(", ")}`,
    "과장 표현(절대, 무조건, 100%, 대박 등)은 쓰지 않는다.",
  ].join("\n");
}
