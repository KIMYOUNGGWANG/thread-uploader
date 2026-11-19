import Anthropic from "@anthropic-ai/sdk";
import { CLAUDE_TEXT_MODEL, readMessageText } from "@/lib/claude-text";
import { extractJsonObject } from "@/lib/llm-judge";
import { NEWS_PLATFORMS, verifyFacts, type Fact, type NewsPlatform } from "./verify";

export interface ComposeSource {
  title: string | null;
  url: string | null;
  text: string;
  operatorNote: string | null;
  imageCount: number;
}

export interface Composed {
  facts: Fact[];
  drafts: Record<NewsPlatform, string>;
}

const PROMPT_SOURCE_CHARS = 12_000;

export function buildComposePrompt(source: ComposeSource, feedback: string | null = null): string {
  const telegramBudget = source.imageCount > 0 ? "이미지 캡션이라 900자 이내" : "1,500자 이내";
  return [
    "너는 AI·테크 뉴스를 여러 SNS 채널에 맞게 정리하는 에디터다. 아래 기사만 근거로 써라.",
    "절대 규칙: 기사에 없는 사실·숫자·인용을 만들지 마. 모르면 쓰지 마. 기사 문장을 통째로 베끼지 말고 요약해라.",
    "",
    `기사 제목: ${source.title ?? "(없음)"}`,
    `원문 URL: ${source.url ?? "(없음)"}`,
    ...(source.operatorNote ? [`운영자 의견/강조(원고에 의견으로 녹여라): ${source.operatorNote}`] : []),
    "기사 본문:",
    "<<<",
    source.text.slice(0, PROMPT_SOURCE_CHARS),
    ">>>",
    "",
    "만들 것:",
    "1. facts: 핵심 사실 3~6개. 각 사실마다 evidence에 기사 본문에서 **글자 그대로 복사한** 연속 구절(15~80자)을 넣어라. 바꿔 쓰면 검증에서 떨어진다.",
    `2. telegram: 텔레그램 채널용 (${telegramBudget}). 첫 줄 이모지 1개 + 제목, 빈 줄, 핵심 3~5줄('• '로 시작), 운영자 의견이 있으면 한 줄, 마지막 줄 '🔗 원문: URL'(URL이 있을 때만). 마크다운 기호(**, #) 쓰지 마.`,
    "3. threads: 스레드용 450자 이내. 첫 줄은 궁금하게 만드는 한 문장. 해시태그·링크 넣지 마. 댓글·DM 요구 금지.",
    "4. kakao: 단톡방용 300자 이내. 짧은 요약 2~3줄 + 마지막 줄 원문 URL(있을 때만).",
    ...(feedback ? ["", `이전 답의 문제(반드시 고쳐라): ${feedback}`] : []),
    "",
    'JSON 하나로만 답해라: {"facts":[{"text":"...","evidence":"..."}],"telegram":"...","threads":"...","kakao":"..."}',
  ].join("\n");
}

export function parseComposed(text: string, sourceText: string): Composed | null {
  const json = extractJsonObject(text);
  if (!json || !Array.isArray(json.facts)) return null;
  const drafts = {} as Record<NewsPlatform, string>;
  for (const platform of NEWS_PLATFORMS) {
    const value = json[platform];
    if (typeof value !== "string" || !value.trim()) return null;
    drafts[platform] = value.trim();
  }
  const facts = verifyFacts(
    json.facts.filter((f): f is Record<string, unknown> => typeof f === "object" && f !== null).map((f) => ({ text: f.text, evidence: f.evidence })),
    sourceText,
  );
  return { facts, drafts };
}

type Complete = (prompt: string) => Promise<string>;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 90_000, maxRetries: 1 });

const completeWithClaude: Complete = async (prompt) => {
  const message = await client.messages.create({
    model: CLAUDE_TEXT_MODEL,
    max_tokens: 6000,
    output_config: { effort: "low" },
    messages: [{ role: "user", content: prompt }],
  });
  return readMessageText(message);
};

/** Raw mode skips the model: every platform gets the source text as-is and there are no extracted facts. */
export function composeRaw(sourceText: string): Composed {
  const text = sourceText.trim();
  return { facts: [], drafts: { telegram: text, threads: text, kakao: text } };
}

/** One retry on malformed output; null = no usable draft after both attempts. */
export async function composeDrafts(source: ComposeSource, complete: Complete = completeWithClaude): Promise<Composed | null> {
  let feedback: string | null = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const composed = parseComposed(await complete(buildComposePrompt(source, feedback)), source.text);
    if (composed) return composed;
    feedback = "JSON 형식이 틀렸거나 telegram/threads/kakao 중 빈 원고가 있었음";
  }
  return null;
}
