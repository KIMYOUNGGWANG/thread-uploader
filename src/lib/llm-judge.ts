import Anthropic from "@anthropic-ai/sdk";
import { CLAUDE_TEXT_MODEL, readMessageText } from "@/lib/claude-text";

// Shared by the LLM judges. Fail-open: null means "no usable answer" and the caller treats the post as passing.
export async function callTextJudge(prompt: string, tag: string): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  // Same client settings as remediation-engine: a stalled request must not block the batch.
  const anthropic = new Anthropic({ apiKey, timeout: 20000, maxRetries: 1 });
  try {
    const response = await anthropic.messages.create({
      model: CLAUDE_TEXT_MODEL,
      max_tokens: 200,
      thinking: { type: "disabled" },
      output_config: { effort: "low" },
      messages: [{ role: "user", content: prompt }],
    });
    return readMessageText(response);
  } catch (error) {
    console.warn(`[${tag}] Judge failed; treating the post as passing:`, error);
    return null;
  }
}

export function extractJsonObject(text: string): Record<string, unknown> | null {
  const block = text.match(/\{[\s\S]*\}/)?.[0];
  if (!block) return null;
  try {
    const parsed: unknown = JSON.parse(block);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}
