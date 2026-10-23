import Anthropic from "@anthropic-ai/sdk";
import { CLAUDE_TEXT_MODEL, readMessageText } from "@/lib/claude-text";

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
  const block = text.match(/\{[\s\S]*\}/)?.[0];
  if (!block) return PASS;
  try {
    const parsed: unknown = JSON.parse(block);
    if (typeof parsed !== "object" || parsed === null) return PASS;
    const { natural, reason } = parsed as Record<string, unknown>;
    if (typeof natural !== "boolean") return PASS;
    if (natural) return PASS;
    // Retry feedback needs something to act on even when the model leaves the reason out.
    const text = typeof reason === "string" ? reason.trim() : "";
    return { natural, reason: text || "awkward phrasing" };
  } catch {
    return PASS;
  }
}

export async function judgeEnglishNaturalness(post: string): Promise<NaturalnessVerdict> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return PASS;

  // Same client settings as remediation-engine: a stalled request must not block the batch.
  const anthropic = new Anthropic({ apiKey, timeout: 20000, maxRetries: 1 });
  try {
    const response = await anthropic.messages.create({
      model: CLAUDE_TEXT_MODEL,
      max_tokens: 200,
      thinking: { type: "disabled" },
      output_config: { effort: "low" },
      messages: [{ role: "user", content: buildPrompt(post) }],
    });
    return parseNaturalnessVerdict(readMessageText(response));
  } catch (error) {
    console.warn("[EnglishNaturalness] Judge failed; treating the post as natural:", error);
    return PASS;
  }
}
