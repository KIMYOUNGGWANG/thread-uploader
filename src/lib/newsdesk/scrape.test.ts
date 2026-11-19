import { describe, expect, it, vi } from "vitest";
import { assertPublicUrl, decodeHtml, extractArticle, fetchArticleHtml, isPrivateAddress, ScrapeError } from "./scrape";

const publicResolver = vi.fn(async () => ["93.184.216.34"]);

describe("isPrivateAddress", () => {
  it.each(["127.0.0.1", "10.1.2.3", "172.16.0.1", "172.31.255.255", "192.168.0.10", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "::", "fd00::1", "fe80::1", "::ffff:127.0.0.1", "::ffff:10.0.0.1"])(
    "blocks %s",
    (ip) => expect(isPrivateAddress(ip)).toBe(true),
  );
  it.each(["93.184.216.34", "172.32.0.1", "8.8.8.8", "2606:4700::1111"])("allows %s", (ip) => {
    expect(isPrivateAddress(ip)).toBe(false);
  });
});

describe("assertPublicUrl", () => {
  it("rejects non-http schemes, credentials and odd ports", async () => {
    await expect(assertPublicUrl("file:///etc/passwd", publicResolver)).rejects.toBeInstanceOf(ScrapeError);
    await expect(assertPublicUrl("ftp://example.com/a", publicResolver)).rejects.toBeInstanceOf(ScrapeError);
    await expect(assertPublicUrl("https://user:pw@example.com/", publicResolver)).rejects.toBeInstanceOf(ScrapeError);
    await expect(assertPublicUrl("http://example.com:8080/", publicResolver)).rejects.toBeInstanceOf(ScrapeError);
  });

  it("rejects hosts that resolve to a private address, even when only one of them does", async () => {
    await expect(assertPublicUrl("http://localhost/", async () => ["127.0.0.1"])).rejects.toBeInstanceOf(ScrapeError);
    await expect(assertPublicUrl("http://mixed.example/", async () => ["93.184.216.34", "10.0.0.5"])).rejects.toBeInstanceOf(ScrapeError);
    await expect(assertPublicUrl("http://10.0.0.1/", publicResolver)).rejects.toBeInstanceOf(ScrapeError);
    await expect(assertPublicUrl("http://[::1]/", publicResolver)).rejects.toBeInstanceOf(ScrapeError);
  });

  it("accepts a public https url", async () => {
    const url = await assertPublicUrl("https://zdnet.co.kr/view/?no=1", publicResolver);
    expect(url.hostname).toBe("zdnet.co.kr");
  });
});

function htmlResponse(body: string, init: ResponseInit & { contentType?: string } = {}) {
  return new Response(body, { status: init.status ?? 200, headers: { "content-type": init.contentType ?? "text/html; charset=utf-8", ...(init.headers ?? {}) } });
}

describe("fetchArticleHtml", () => {
  it("follows a redirect only after re-checking the target", async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: "http://169.254.169.254/latest/meta-data" } }));
    await expect(fetchArticleHtml("https://news.example/a", { fetchImpl, resolve: async (host) => (host === "169.254.169.254" ? ["169.254.169.254"] : ["93.184.216.34"]) }))
      .rejects.toBeInstanceOf(ScrapeError);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("follows a public redirect and returns the final html", async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 301, headers: { location: "/final" } }))
      .mockResolvedValueOnce(htmlResponse("<p>hello</p>"));
    const result = await fetchArticleHtml("https://news.example/a", { fetchImpl, resolve: publicResolver });
    expect(result.html).toContain("hello");
    expect(result.finalUrl).toBe("https://news.example/final");
    expect(fetchImpl.mock.calls[0][1]).toMatchObject({ redirect: "manual" });
  });

  it("stops after too many redirects", async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 302, headers: { location: "/loop" } }));
    await expect(fetchArticleHtml("https://news.example/a", { fetchImpl, resolve: publicResolver })).rejects.toThrow(/리다이렉트/);
  });

  it("rejects non-html and oversized bodies", async () => {
    const pdf = vi.fn(async () => htmlResponse("%PDF", { contentType: "application/pdf" }));
    await expect(fetchArticleHtml("https://news.example/a", { fetchImpl: pdf, resolve: publicResolver })).rejects.toThrow(/HTML/);
    const huge = vi.fn(async () => htmlResponse("x".repeat(50), { headers: { "content-length": String(10 * 1024 * 1024) } }));
    await expect(fetchArticleHtml("https://news.example/a", { fetchImpl: huge, resolve: publicResolver })).rejects.toThrow(/너무 커/);
  });

  it("reports http errors in plain words", async () => {
    const notFound = vi.fn(async () => htmlResponse("nope", { status: 404 }));
    await expect(fetchArticleHtml("https://news.example/a", { fetchImpl: notFound, resolve: publicResolver })).rejects.toThrow(/HTTP 404/);
  });
});

describe("decodeHtml", () => {
  // "<p>한국</p>" in EUC-KR
  const eucKr = new Uint8Array([0x3c, 0x70, 0x3e, 0xc7, 0xd1, 0xb1, 0xb9, 0x3c, 0x2f, 0x70, 0x3e]);

  it("uses the content-type charset", () => {
    expect(decodeHtml(eucKr, "text/html; charset=EUC-KR")).toBe("<p>한국</p>");
  });

  it("falls back to the meta charset when the header has none", () => {
    const head = new TextEncoder().encode('<meta charset="euc-kr">');
    const bytes = new Uint8Array([...head, ...eucKr]);
    expect(decodeHtml(bytes, "text/html")).toContain("한국");
  });

  it("defaults to utf-8 and survives an unknown label", () => {
    const bytes = new TextEncoder().encode("<p>안녕</p>");
    expect(decodeHtml(bytes, "text/html; charset=bogus-label")).toBe("<p>안녕</p>");
  });
});

const longSentence = "마이크로소프트는 이그나이트 2026 컨퍼런스에서 MAI 계열의 새로운 자체 AI 모델 7개를 공개했다고 밝혔다.";

describe("extractArticle", () => {
  it("reads og tags and paragraphs inside <article>, skipping scripts and nav", () => {
    const html = `<html><head><title>Fallback</title>
      <meta property="og:title" content="MS, 자체 AI 모델 7종 공개 &amp; 가격">
      <meta property="og:image" content="https://img.example/a.jpg">
      <meta property="og:description" content="요약">
      <script>var x = "<p>script text</p>";</script></head>
      <body><nav><p>메뉴 링크</p></nav>
      <article><p>${longSentence}</p><p>MAI Code 2 모델의 가격은 100만 토큰당 2.50달러입니다.&nbsp;&#49;&#x32;</p></article>
      <footer><p>저작권</p></footer></body></html>`;
    const article = extractArticle(html);
    expect(article.title).toBe("MS, 자체 AI 모델 7종 공개 & 가격");
    expect(article.imageUrl).toBe("https://img.example/a.jpg");
    expect(article.text).toContain(longSentence);
    expect(article.text).toContain("2.50달러입니다. 12");
    expect(article.text).not.toContain("script text");
    expect(article.text).not.toContain("메뉴 링크");
    expect(article.text).not.toContain("저작권");
  });

  it("falls back to <br>-separated text in divs when there are no paragraphs", () => {
    const html = `<html><head><title>제목 | 매체</title></head><body><div id="articleBody">${longSentence}<br><br>${longSentence.replace("7개", "8개")}<br>짧은 줄</div></body></html>`;
    const article = extractArticle(html);
    expect(article.title).toBe("제목 | 매체");
    expect(article.text).toContain("8개를 공개");
    expect(article.text).not.toContain("짧은 줄");
  });
});
