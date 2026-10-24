import Anthropic from "@anthropic-ai/sdk";
import { CLAUDE_TEXT_MODEL, readMessageText } from "@/lib/claude-text";

export interface ReadabilityVerdict {
  readable: boolean;
  reason: string;
}

const PASS: ReadabilityVerdict = { readable: true, reason: "" };

const buildPrompt = (post: string, firstComment: string) => `너는 사주를 전혀 모르는 25~35세 독자야. 썸·이별·이직 고민이 있고, 피드에서 첫 두 줄만 보고 계속 읽을지 정해.
아래 Threads 글(본문과 첫 댓글)을 이 독자로서 읽고 세 질문에 답해.
1. keepReading: 첫 두 줄만 보고 계속 읽고 싶은가?
2. understandable: 사주를 몰라도 모든 문장의 뜻을 이해할 수 있는가?
3. takeaway: 다 읽고 오늘 바로 써먹을 생각이나 행동이 하나 남는가? ("네 원국을 봐야 안다"는 남는 것으로 치지 않는다.)

필수 형식이니 이것만으로 아니오라고 하지 마:
- 번호 선택지(1/2/3 또는 A/B/C)와 닫는 질문 하나는 허용된 형식이다.
- 사주 용어는 많아야 하나, 같은 문장이나 바로 다음 문장에서 쉬운 말로 풀어주면 의도된 것이다.
확실할 때만 아니오라고 하고, 헷갈리면 예라고 해.

JSON 객체 하나만 출력해. 다른 글은 쓰지 마:
{"keepReading": true|false, "understandable": true|false, "takeaway": true|false, "reason": "<아니오인 항목과 걸린 문장, 모두 예면 빈 문자열>"}

[본문]
"""
${post}
"""

[첫 댓글]
"""
${firstComment}
"""`;

// Fail-open: anything unreadable counts as readable so the judge can never block generation.
export function parseReadabilityVerdict(text: string): ReadabilityVerdict {
  const block = text.match(/\{[\s\S]*\}/)?.[0];
  if (!block) return PASS;
  try {
    const parsed: unknown = JSON.parse(block);
    if (typeof parsed !== "object" || parsed === null) return PASS;
    const { keepReading, understandable, takeaway, reason } = parsed as Record<string, unknown>;
    if (typeof keepReading !== "boolean" || typeof understandable !== "boolean" || typeof takeaway !== "boolean") return PASS;
    if (keepReading && understandable && takeaway) return PASS;
    // Retry feedback needs something to act on even when the model leaves the reason out.
    const detail = typeof reason === "string" ? reason.trim() : "";
    return { readable: false, reason: detail || "사주를 모르는 독자가 읽기 어려움" };
  } catch {
    return PASS;
  }
}

export async function judgeReadability(post: string, firstComment: string): Promise<ReadabilityVerdict> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return PASS;

  // Same client settings as english-naturalness: a stalled request must not block the batch.
  const anthropic = new Anthropic({ apiKey, timeout: 20000, maxRetries: 1 });
  try {
    const response = await anthropic.messages.create({
      model: CLAUDE_TEXT_MODEL,
      max_tokens: 200,
      thinking: { type: "disabled" },
      output_config: { effort: "low" },
      messages: [{ role: "user", content: buildPrompt(post, firstComment) }],
    });
    return parseReadabilityVerdict(readMessageText(response));
  } catch (error) {
    console.warn("[ReadabilityJudge] Judge failed; treating the post as readable:", error);
    return PASS;
  }
}
