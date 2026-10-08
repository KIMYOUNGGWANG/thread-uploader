import type Anthropic from "@anthropic-ai/sdk";

export const CLAUDE_TEXT_MODEL = process.env.ANTHROPIC_GENERATION_MODEL ?? "claude-haiku-5-5";

// Haiku 5.5 thinks by default, so the answer can follow thinking blocks: read text blocks by type.
export function readMessageText(message: Pick<Anthropic.Message, "content" | "stop_reason">): string {
  if (message.stop_reason === "refusal") throw new Error("Claude declined the request (refusal)");
  const text = message.content
    .flatMap((block) => (block.type === "text" ? [block.text] : []))
    .join("")
    .trim();
  if (!text) throw new Error(`Claude returned no text (stop_reason: ${message.stop_reason})`);
  return text;
}
