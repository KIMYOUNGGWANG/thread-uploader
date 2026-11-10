import { callTextJudge, extractJsonObject } from "@/lib/llm-judge";

export const FORMAT_HINTS = ["trend_list", "celeb_business", "mindset"] as const;
export type FormatHint = (typeof FORMAT_HINTS)[number];

export interface ScoredArticle {
  score: number;
  formatHint: FormatHint;
}

// Weights come from the 2026-11-09 benchmark (@wellness_highlight, 156 posts): celebrity/brand business stories and
// trend lists drew 1,000-4,290 likes; weekly news digests (43) and plain foreign brand news (50-60) drew almost nothing.
export function buildScorePrompt(articles: Array<{ title: string }>): string {
  const list = articles.map((article, index) => `${index + 1}. ${article.title}`).join("\n");
  return [
    "너는 '웰니스 × 비즈니스' 인스타 매거진의 편집장이다. 아래 기사 제목마다 카드뉴스 글감으로서의 점수(0~100)와 포맷을 매겨라.",
    "높은 점수: 셀럽·창업자·브랜드가 웰니스로 돈을 번 이야기, 소비·웰니스 트렌드를 숫자 리스트로 풀 수 있는 소식, 2030의 일·회복·마인드셋에 바로 쓰이는 이야기.",
    "낮은 점수: 단순 신제품 출시·인사·주가 소식, 의료 시술 홍보, 맥락 없는 해외 단신, 정치·사건사고.",
    "포맷: trend_list(트렌드 리스트) | celeb_business(셀럽·브랜드 사업 성공기) | mindset(마인드셋)",
    `JSON 하나로만 답해라: {"scores":[{"i":1,"s":80,"f":"celeb_business"}, ...]}`,
    "",
    list,
  ].join("\n");
}

export function parseScores(text: string, count: number): Map<number, ScoredArticle> {
  const result = new Map<number, ScoredArticle>();
  const scores = extractJsonObject(text)?.scores;
  if (!Array.isArray(scores)) return result;
  for (const entry of scores) {
    if (typeof entry !== "object" || entry === null) continue;
    const { i, s, f } = entry as Record<string, unknown>;
    if (typeof i !== "number" || !Number.isInteger(i) || i < 1 || i > count) continue;
    if (typeof s !== "number" || !Number.isFinite(s)) continue;
    const formatHint = FORMAT_HINTS.includes(f as FormatHint) ? (f as FormatHint) : "trend_list";
    result.set(i - 1, { score: Math.max(0, Math.min(100, Math.round(s))), formatHint });
  }
  return result;
}

// Returns scores by array index; an empty map means the judge failed and the articles stay unscored for the next run.
export async function scoreArticles(articles: Array<{ title: string }>): Promise<Map<number, ScoredArticle>> {
  if (articles.length === 0) return new Map();
  const text = await callTextJudge(buildScorePrompt(articles), "wellness-score");
  return text ? parseScores(text, articles.length) : new Map();
}
