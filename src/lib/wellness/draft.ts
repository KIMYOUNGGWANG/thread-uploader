import Anthropic from "@anthropic-ai/sdk";
import { CLAUDE_TEXT_MODEL, readMessageText } from "@/lib/claude-text";
import { extractJsonObject } from "@/lib/llm-judge";
import { cardPostSurface, findComplianceIssues } from "@/lib/wellness/compliance";
import { MAX_ITEMS, MAX_SLIDES, MIN_SLIDES, type CardSlide } from "@/lib/wellness/slides";

export type { CardSlide };

export interface WellnessDraft {
  threadsText: string;
  instagramCaption: string;
  slides: CardSlide[];
}

export interface DraftResult extends WellnessDraft {
  issues: string[];
}

export interface DraftSource {
  title: string;
  url: string;
  formatHint: string | null;
}

const FORMAT_GUIDE: Record<string, string> = {
  trend_list: "트렌드 리스트: 숫자로 정리한 키워드·변화 N가지",
  celeb_business: "셀럽·브랜드 사업 성공기: 그 사람·브랜드가 한 선택과 원칙 N가지",
  mindset: "마인드셋: 2030이 일과 회복에 바로 써볼 태도 N가지",
};

export function buildDraftPrompt(source: DraftSource, feedback: string[] = []): string {
  return [
    "너는 '웰니스 × 비즈니스' 인스타 매거진 에디터다. 아래 기사를 한국어 카드뉴스 한 편으로 재구성해라. 기사 문장을 그대로 옮기지 말고 요약·재구성해라.",
    `포맷: ${FORMAT_GUIDE[source.formatHint ?? ""] ?? FORMAT_GUIDE.trend_list}`,
    `기사: ${source.title}`,
    `원문: ${source.url}`,
    "",
    "구조(카드 7~10장):",
    "1장 = 💜 훅. 인용문이나 숫자로 시작하는 짧은 헤드라인 + 한 줄 부제",
    "2장 = 통념 뒤집기. '~라고 생각하기 쉽지만, 사실은 ~'",
    "3장~(끝-1)장 = 번호 리스트. 장마다 headline 1개 + body 1~2문장 (items를 쓰면 최대 6개)",
    "마지막 장 = 저장 유도 CTA ('저장해두고 ~할 때 꺼내 보세요' 같은 문장). 댓글·DM 요구 금지",
    "",
    "금지: 질병 치료·예방 표현, 효능 단정('살 빠지는', '면역력 강화', '100% 효과'), 건강기능식품 추천, 확인 안 된 숫자 지어내기.",
    "instagramCaption: 💜훅💜 한 줄 → 3~5문장 요약 → 번호 리스트 요약 → 저장 CTA → '📍Source 매체명' → 해시태그 3~5개.",
    "threadsText: 같은 내용을 스레드용 글 하나로(500자 이내, 해시태그 없이).",
    ...(feedback.length > 0 ? ["", `이전 초안에서 걸린 문제(반드시 고쳐라): ${feedback.join(" / ")}`] : []),
    "",
    `JSON 하나로만 답해라: {"threadsText":"...","instagramCaption":"...","slides":[{"headline":"...","body":"..."},{"headline":"...","items":["..."]}]}`,
  ].join("\n");
}

const nonEmpty = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;

export function parseDraft(text: string): WellnessDraft | null {
  const json = extractJsonObject(text);
  if (!json || !nonEmpty(json.threadsText) || !nonEmpty(json.instagramCaption) || !Array.isArray(json.slides)) return null;
  const slides: CardSlide[] = [];
  for (const raw of json.slides) {
    if (typeof raw !== "object" || raw === null) return null;
    const { headline, body, items } = raw as Record<string, unknown>;
    if (!nonEmpty(headline)) return null;
    const slide: CardSlide = { headline: headline.trim() };
    if (nonEmpty(body)) slide.body = body.trim();
    if (Array.isArray(items)) {
      const list = items.filter(nonEmpty).map((item) => item.trim());
      if (list.length > MAX_ITEMS) return null;
      if (list.length > 0) slide.items = list;
    }
    slides.push(slide);
  }
  if (slides.length < MIN_SLIDES || slides.length > MAX_SLIDES) return null;
  return { threadsText: json.threadsText.trim(), instagramCaption: json.instagramCaption.trim(), slides };
}

export function draftSurface(draft: WellnessDraft): string {
  return cardPostSurface({ content: draft.threadsText, instagramCaption: draft.instagramCaption, slides: draft.slides });
}

type Complete = (prompt: string) => Promise<string>;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 60000, maxRetries: 1 });

const completeWithClaude: Complete = async (prompt) => {
  const message = await client.messages.create({
    model: CLAUDE_TEXT_MODEL,
    max_tokens: 4000,
    output_config: { effort: "low" },
    messages: [{ role: "user", content: prompt }],
  });
  return readMessageText(message);
};

// One rewrite when the draft is malformed or trips a compliance rule. A draft that still trips one is returned with its
// issues so a human sees them in review; it is never auto-approved. null = no usable draft after both attempts.
export async function generateDraft(
  source: DraftSource,
  brandPhrases: string[],
  complete: Complete = completeWithClaude,
): Promise<DraftResult | null> {
  let feedback: string[] = [];
  let last: DraftResult | null = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const draft = parseDraft(await complete(buildDraftPrompt(source, feedback)));
    if (!draft) {
      feedback = [`JSON 형식이 틀렸거나 카드가 ${MIN_SLIDES}~${MAX_SLIDES}장이 아님`];
      continue;
    }
    const issues = findComplianceIssues(draftSurface(draft), brandPhrases);
    last = { ...draft, issues };
    if (issues.length === 0) return last;
    feedback = issues;
  }
  return last;
}
