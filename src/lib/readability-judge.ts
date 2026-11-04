import { callTextJudge, extractJsonObject } from "@/lib/llm-judge";

export interface ReadabilityVerdict {
  readable: boolean;
  reason: string;
}

const PASS: ReadabilityVerdict = { readable: true, reason: "" };

// 2026-11-04: the third question ("오늘 바로 써먹을 행동이 남는가?") failed every draft that ended on a punchline,
// so the feed turned into homework posts ("세 개만 적어", "오늘 할 일:"). Shares and saves, not homework, carry reach.
const TERM_RULE_DEFAULT = "- 사주 용어는 많아야 하나, 같은 문장이나 바로 다음 문장에서 쉬운 말로 풀어주면 의도된 것이다.";
const TERM_RULE_RANKED = "- 같은 종류 사주 개념 2~3개를 '~보다 센'으로 줄 세운 서열 비교는 의도된 형식이다. 마지막 개념만 쉬운 말로 풀어줘도 된다.";

const buildPrompt = (post: string, firstComment: string, rankedTerms: boolean) => `너는 사주를 전혀 모르는 25~35세 독자야. 썸·이별·이직 고민이 있고, 피드에서 첫 두 줄만 보고 계속 읽을지 정해.
아래 Threads 글(본문과 첫 댓글)을 이 독자로서 읽고 두 질문에 답해.
1. keepReading: 첫 두 줄만 보고 계속 읽고 싶은가?
2. understandable: 사주를 몰라도 글의 요지를 이해할 수 있는가?

필수 형식이니 이것만으로 아니오라고 하지 마:
- 번호 선택지(1/2/3 또는 A/B/C)와 닫는 질문 하나는 허용된 형식이다.
- 교훈이나 할 일 없이 단언·비유 한 줄로 끝나는 것은 의도된 형식이다.
${rankedTerms ? TERM_RULE_RANKED : TERM_RULE_DEFAULT}
확실할 때만 아니오라고 하고, 헷갈리면 예라고 해.

JSON 객체 하나만 출력해. 다른 글은 쓰지 마:
{"keepReading": true|false, "understandable": true|false, "reason": "<아니오인 항목과 걸린 문장, 모두 예면 빈 문자열>"}

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
  const parsed = extractJsonObject(text);
  if (!parsed) return PASS;
  const { keepReading, understandable, reason } = parsed;
  if (typeof keepReading !== "boolean" || typeof understandable !== "boolean") return PASS;
  if (keepReading && understandable) return PASS;
  // Retry feedback needs something to act on even when the model leaves the reason out.
  const detail = typeof reason === "string" ? reason.trim() : "";
  return { readable: false, reason: detail || "사주를 모르는 독자가 읽기 어려움" };
}

export async function judgeReadability(
  post: string,
  firstComment: string,
  options: { rankedTerms?: boolean } = {}
): Promise<ReadabilityVerdict> {
  const text = await callTextJudge(buildPrompt(post, firstComment, Boolean(options.rankedTerms)), "ReadabilityJudge");
  return text === null ? PASS : parseReadabilityVerdict(text);
}
