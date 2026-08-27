/**
 * Realtime News RSS Fetcher & Parser (Inspired by autoTHREADS)
 * Fetches trending topic headlines from Google News RSS in Korean.
 */

export interface NewsArticle {
  id: string;
  title: string;
  cleanTitle: string;
  link: string;
  source: string;
  pubDate: string;
}

/**
 * Decodes HTML entities and strips unwanted markup.
 */
export function decodeHtmlEntities(raw: string): string {
  return raw
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .trim();
}

/**
 * Parses an RSS XML string into structured NewsArticle objects.
 */
export function parseRssXml(xml: string, limit = 5): NewsArticle[] {
  const articles: NewsArticle[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match: RegExpExecArray | null;

  while ((match = itemRegex.exec(xml)) !== null && articles.length < limit) {
    const itemContent = match[1];

    const titleMatch = itemContent.match(/<title>([\s\S]*?)<\/title>/);
    const linkMatch = itemContent.match(/<link>([\s\S]*?)<\/link>/);
    const pubDateMatch = itemContent.match(/<pubDate>([\s\S]*?)<\/pubDate>/);
    const sourceMatch = itemContent.match(/<source[^>]*>([\s\S]*?)<\/source>/);

    if (titleMatch && linkMatch) {
      const rawTitle = decodeHtmlEntities(titleMatch[1]);
      let cleanTitle = rawTitle;
      let sourceName = sourceMatch ? decodeHtmlEntities(sourceMatch[1]) : "";

      // Most news RSS titles end with "- MediaName"
      const dashSplit = rawTitle.split(/\s*-\s*(?=[^-]+$)/);
      if (dashSplit.length === 2 && !sourceName) {
        cleanTitle = dashSplit[0].trim();
        sourceName = dashSplit[1].trim();
      } else if (dashSplit.length === 2) {
        cleanTitle = dashSplit[0].trim();
      }

      articles.push({
        id: `news_${articles.length + 1}_${Date.now()}`,
        title: rawTitle,
        cleanTitle,
        link: decodeHtmlEntities(linkMatch[1]),
        source: sourceName || "주요 언론사",
        pubDate: pubDateMatch ? pubDateMatch[1].trim() : new Date().toISOString(),
      });
    }
  }

  return articles;
}

/**
 * Fetches trending news from Google News RSS for a given query keyword.
 */
export async function fetchTrendingNews(query: string, limit = 5): Promise<NewsArticle[]> {
  const encoded = encodeURIComponent(query);
  const url = `https://news.google.com/rss/search?q=${encoded}&hl=ko&gl=KR&ceid=KR:ko`;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; ThreadsUploaderBot/1.0)",
      },
    });
    clearTimeout(timer);

    if (!res.ok) {
      throw new Error(`Google News RSS fetch failed: ${res.status}`);
    }

    const xml = await res.text();
    return parseRssXml(xml, limit);
  } catch (error) {
    console.error("fetchTrendingNews error:", error);
    return [];
  }
}

/**
 * Builds a prompt for generating a Threads post based on a news article.
 */
export function buildNewsPostPrompt(article: NewsArticle, perspective?: string): string {
  return [
    `[실시간 뉴스 기반 Threads 스레드 작성]`,
    `- 뉴스 헤드라인: "${article.cleanTitle}"`,
    `- 출처 언론사: ${article.source}`,
    `- 기사 원문 링크: ${article.link}`,
    "",
    "작성 지침:",
    "1. 기사 내용을 그대로 복사하지 말고, 이 뉴스가 주는 실질적인 의미나 변화를 1줄 훅으로 요약한다.",
    "2. 본문에는 이 소식이 실무자/독자에게 왜 중요한지 2-3가지 관전 포인트를 설명한다.",
    perspective ? `3. 강조할 관점: ${perspective}` : "3. 개인적인 인사이트나 현업 관점을 덧붙인다.",
    "4. 본문에는 URL을 넣지 않고, 첫 댓글에 기사 원문 출처를 안내한다.",
    "5. 전체 본문은 400자 이하로 작성한다.",
  ].join("\n");
}
