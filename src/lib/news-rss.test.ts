import { describe, expect, it } from "vitest";
import {
  decodeHtmlEntities,
  parseRssXml,
  buildNewsPostPrompt,
  type NewsArticle,
} from "./news-rss";

describe("news-rss", () => {
  it("decodes HTML entities properly", () => {
    const raw = "&quot;AI 혁신&quot; &amp; &lt;스타트업&gt; &#39;기회&#39;";
    expect(decodeHtmlEntities(raw)).toBe('"AI 혁신" & <스타트업> \'기회\'');
  });

  it("parses RSS XML into structured articles with separated source", () => {
    const sampleXml = `
      <rss version="2.0">
        <channel>
          <title>Google News</title>
          <item>
            <title>&quot;챗GPT 새 모델 출시&quot; 개발자 생태계 대격변 - 조선일보</title>
            <link>https://news.google.com/articles/12345</link>
            <pubDate>Thu, 27 Aug 2026 12:00:00 GMT</pubDate>
            <source url="https://chosun.com">조선일보</source>
          </item>
          <item>
            <title>생성형 AI 도입 기업 80% 돌파 - 연합뉴스</title>
            <link>https://news.google.com/articles/67890</link>
            <pubDate>Thu, 27 Aug 2026 13:00:00 GMT</pubDate>
          </item>
        </channel>
      </rss>
    `;

    const articles = parseRssXml(sampleXml, 5);
    expect(articles.length).toBe(2);

    expect(articles[0].cleanTitle).toBe('"챗GPT 새 모델 출시" 개발자 생태계 대격변');
    expect(articles[0].source).toBe("조선일보");
    expect(articles[0].link).toBe("https://news.google.com/articles/12345");

    expect(articles[1].cleanTitle).toBe("생성형 AI 도입 기업 80% 돌파");
    expect(articles[1].source).toBe("연합뉴스");
  });

  it("builds a prompt for a news article", () => {
    const article: NewsArticle = {
      id: "news_1",
      title: "AI 채용 도구 확산",
      cleanTitle: "AI 채용 도구 확산",
      link: "https://example.com/news/1",
      source: "테크뉴스",
      pubDate: "2026-08-27",
    };

    const prompt = buildNewsPostPrompt(article, "취준생 입장에서의 대응 전략");
    expect(prompt).toContain('뉴스 헤드라인: "AI 채용 도구 확산"');
    expect(prompt).toContain("출처 언론사: 테크뉴스");
    expect(prompt).toContain("취준생 입장에서의 대응 전략");
    expect(prompt).toContain("첫 댓글에 기사 원문 출처를 안내한다");
  });
});
