import { callTextJudge, extractJsonObject } from "@/lib/llm-judge";

export interface NaturalnessVerdict {
  natural: boolean;
  reason: string;
}

const PASS: NaturalnessVerdict = { natural: true, reason: "" };

const buildPrompt = (post: string) => `You are a native English-speaking editor reviewing a Threads post.
Flag any sentence a native speaker would not write: stacked hedges (e.g. "actually ..., instead"), translation-ese or calques, forced rhetorical questions.
The closing option lines starting with "A) " / "B) " and a closing question like "Which one are you?" are required format; never flag them.
Romanized Korean terms followed by a one-line gloss are intended, not awkward.
Flag only if a native speaker would clearly not write it; when unsure, answer natural.
Reply with ONLY one JSON object, no other text:
- awkward sentence found: {"natural": false, "reason": "<which sentence and why>"}
- reads natural: {"natural": true, "reason": ""}

Post:
"""
${post}
"""`;

// Fail-open: anything unreadable counts as natural so the judge can never block generation.
export function parseNaturalnessVerdict(text: string): NaturalnessVerdict {
  const parsed = extractJsonObject(text);
  if (!parsed) return PASS;
  const { natural, reason } = parsed;
  if (typeof natural !== "boolean" || natural) return PASS;
  // Retry feedback needs something to act on even when the model leaves the reason out.
  const detail = typeof reason === "string" ? reason.trim() : "";
  return { natural, reason: detail || "awkward phrasing" };
}

export async function judgeEnglishNaturalness(post: string): Promise<NaturalnessVerdict> {
  const text = await callTextJudge(buildPrompt(post), "EnglishNaturalness");
  return text === null ? PASS : parseNaturalnessVerdict(text);
}
