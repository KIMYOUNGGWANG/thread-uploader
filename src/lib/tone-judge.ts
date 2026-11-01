import { callTextJudge, extractJsonObject } from "@/lib/llm-judge";
import type { BrandConfig } from "@/types/brand";

export interface ToneVerdict {
  /** 0-100, or null when the judge gave no usable answer (fail-open: the caller keeps the draft). */
  score: number | null;
  fixes: string[];
}

const NO_VERDICT: ToneVerdict = { score: null, fixes: [] };

// The voice profile is the runtime source of brand tone; brand-voice.md only exists for local scripts.
function describeVoice(config: Pick<BrandConfig, "voiceProfile" | "systemPrompt">): string {
  const voice = config.voiceProfile;
  if (!voice) return config.systemPrompt.slice(0, 1500);
  return [
    `- 톤: ${voice.tone}`,
    `- 화자 시점: ${voice.perspective}`,
    `- 문장 길이: ${voice.sentenceLength}`,
    `- 문단 스타일: ${voice.paragraphStyle}`,
    `- 고백 방식: ${voice.admissionStyle}`,
    voice.forbiddenPhrases.length > 0 ? `- 금지 표현: ${voice.forbiddenPhrases.join(", ")}` : "",
  ].filter(Boolean).join("\n");
}

const buildPrompt = (post: string, firstComment: string, voice: string) => `너는 이 브랜드의 Threads 계정 편집장이야. 아래 브랜드 톤 기준에 글이 얼마나 맞는지만 채점해. 주제·정보의 정확성은 채점하지 마.

[브랜드 톤 기준]
${voice}

채점 기준:
- 100: 이 계정이 실제로 쓴 글처럼 읽힘
- 80: 대체로 맞지만 한두 문장이 톤에서 벗어남
- 60 이하: 다른 계정 글처럼 읽히거나, 금지 표현·어긋난 말투가 반복됨

JSON 객체 하나만 출력해. 다른 글은 쓰지 마:
{"score": <0-100 정수>, "fixes": ["<톤에서 벗어난 문장> → <어떻게 고칠지>", ...최대 3개, 80점 이상이면 빈 배열]}

[본문]
"""
${post}
"""

[첫 댓글]
"""
${firstComment}
"""`;

export function parseToneVerdict(text: string): ToneVerdict {
  const parsed = extractJsonObject(text);
  if (!parsed) return NO_VERDICT;
  const { score, fixes } = parsed;
  if (typeof score !== "number" || !Number.isFinite(score) || score < 0 || score > 100) return NO_VERDICT;
  const fixList = Array.isArray(fixes) ? fixes.filter((fix): fix is string => typeof fix === "string" && fix.trim() !== "").slice(0, 3) : [];
  return { score: Math.round(score), fixes: fixList };
}

export const TONE_PASS_SCORE = 80;
export const toneReason = (score: number) => `톤 ${score}점`;

interface Drafted<D, G> {
  result: D;
  gate: G;
}

/**
 * Chain: each draft sees the earlier drafts' opening lines and takes a different angle.
 * Evaluate: the gate-passing draft with the best tone score wins; below TONE_PASS_SCORE it is rewritten
 * with the judge's fixes, and a rewrite only replaces it when it passes the gate and scores higher.
 * With no draft passing the gate, the last attempt comes back failed so the caller's gate error stands.
 */
export async function chainDraftsByTone<D extends { post: string; firstComment: string }, G extends { pass: boolean }>(
  count: number,
  draft: (feedback: string[]) => Promise<Drafted<D, G>>,
  judge: (post: string, firstComment: string) => Promise<ToneVerdict>,
  maxRewrites = 2
): Promise<Drafted<D, G> & { tone: ToneVerdict }> {
  const openers: string[] = [];
  const passed: Array<Drafted<D, G> & { tone: ToneVerdict }> = [];
  let last: Drafted<D, G> | null = null;
  for (let i = 0; i < count; i++) {
    const feedback = openers.length > 0
      ? [`앞 초안과 첫 문장·각도·상황이 겹치지 않게 새로 써. 앞 초안 첫 줄: ${openers.map((line) => `"${line}"`).join(", ")}`]
      : [];
    last = await draft(feedback);
    openers.push(last.result.post.split("\n").find((line) => line.trim())?.trim() ?? "");
    if (last.gate.pass) passed.push({ ...last, tone: await judge(last.result.post, last.result.firstComment) });
  }
  if (passed.length === 0) return { ...last!, tone: NO_VERDICT };

  // A null score (judge fail-open) ranks last but still beats having no draft.
  let best = passed.reduce((top, next) => ((next.tone.score ?? -1) > (top.tone.score ?? -1) ? next : top));
  for (let round = 0; round < maxRewrites && best.tone.score !== null && best.tone.score < TONE_PASS_SCORE; round++) {
    const fixes = best.tone.fixes.length > 0 ? best.tone.fixes : ["브랜드 톤 기준에 더 가깝게"];
    const rewrite = await draft([
      `아래 초안(톤 ${best.tone.score}점)을 같은 내용으로 고쳐 써: """${best.result.post}"""`,
      ...fixes.map((fix) => `톤 수정: ${fix}`),
    ]);
    if (!rewrite.gate.pass) continue;
    const tone = await judge(rewrite.result.post, rewrite.result.firstComment);
    if (tone.score !== null && tone.score > best.tone.score) best = { ...rewrite, tone };
  }
  return best;
}

export async function judgeTone(post: string, firstComment: string, config: Pick<BrandConfig, "voiceProfile" | "systemPrompt">): Promise<ToneVerdict> {
  const text = await callTextJudge(buildPrompt(post, firstComment, describeVoice(config)), "ToneJudge");
  return text === null ? NO_VERDICT : parseToneVerdict(text);
}
