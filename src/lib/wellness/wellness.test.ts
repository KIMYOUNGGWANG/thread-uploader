import { describe, expect, it } from "vitest";
import { normalizeUrl, sanitizeText, toArticleRow, urlKeyOf } from "@/lib/wellness/articles";
import { findComplianceIssues } from "@/lib/wellness/compliance";
import { isCardFirstBrand, readWellnessConfig } from "@/lib/wellness/config";
import { buildDraftPrompt, generateDraft, parseDraft } from "@/lib/wellness/draft";
import { parseScores } from "@/lib/wellness/score";

const slides = (n: number) => Array.from({ length: n }, (_, i) => ({ headline: `카드 ${i + 1}`, body: "본문" }));
const draftJson = (n = 8, extra: Record<string, unknown> = {}) =>
  JSON.stringify({ threadsText: "스레드 글", instagramCaption: "💜훅💜 캡션", slides: slides(n), ...extra });

describe("readWellnessConfig", () => {
  it("returns null for brands without a wellness key, so other brands are untouched", () => {
    expect(readWellnessConfig('{"topics":["사주"]}')).toBeNull();
    expect(readWellnessConfig("not json")).toBeNull();
    expect(isCardFirstBrand("{}")).toBe(false);
  });

  it("keeps only http feeds and clamps numbers", () => {
    const config = readWellnessConfig(JSON.stringify({ wellness: { feeds: ["https://a.com/rss", "ftp://x", 3], dailyDrafts: 99 } }));
    expect(config).toEqual({ feeds: ["https://a.com/rss"], dailyDrafts: 5, minScore: 50, maxArticleAgeDays: 3 });
  });
});

describe("article urls", () => {
  it("maps tracking, scheme, host case, fragment and trailing slash variants to one key", () => {
    const base = "https://example.com/story/1";
    for (const variant of [
      "http://Example.com/story/1/",
      "https://www.example.com/story/1?utm_source=x&utm_medium=y",
      "https://example.com/story/1#top",
    ]) {
      expect(normalizeUrl(variant)).toBe(base);
      expect(urlKeyOf(variant)).toBe(urlKeyOf(base));
    }
    expect(urlKeyOf("https://example.com/story/2")).not.toBe(urlKeyOf(base));
    expect(urlKeyOf(base)).toHaveLength(64);
  });

  it("strips NUL and drops stale or link-less items", () => {
    expect(sanitizeText("a\u0000b  c", 10)).toBe("ab c");
    const now = new Date("2026-11-10T00:00:00Z");
    const item = { id: "1", title: "T", cleanTitle: "T", source: "S", link: "https://a.com/x", pubDate: "Mon, 09 Nov 2026 10:00:00 GMT" };
    expect(toArticleRow(item, now, 3)?.publishedAt?.toISOString()).toBe("2026-11-09T10:00:00.000Z");
    expect(toArticleRow({ ...item, pubDate: "Mon, 01 Nov 2026 10:00:00 GMT" }, now, 3)).toBeNull();
    expect(toArticleRow({ ...item, link: "javascript:alert(1)" }, now, 3)).toBeNull();
    expect(toArticleRow({ ...item, pubDate: "garbage" }, now, 3)?.publishedAt).toBeNull();
  });
});

describe("findComplianceIssues", () => {
  it("flags disease, efficacy and weight-loss claims plus brand phrases", () => {
    const issues = findComplianceIssues("이 차 하나로 불면증 개선, 면역력 강화, 살이 빠지는 루틴. 기적의 템", ["기적의"]);
    expect(issues.some((issue) => issue.includes("질병"))).toBe(true);
    expect(issues.some((issue) => issue.includes("효능 단정"))).toBe(true);
    expect(issues.some((issue) => issue.includes("체중"))).toBe(true);
    expect(issues.some((issue) => issue.includes("기적의"))).toBe(true);
  });

  it("passes neutral routine wording", () => {
    expect(findComplianceIssues("잠들기 전 30분 리추얼로 하루를 정리하는 4가지 방법", [])).toEqual([]);
  });
});

describe("parseScores", () => {
  it("maps 1-based indexes, clamps scores and defaults unknown formats", () => {
    const scores = parseScores('설명 {"scores":[{"i":1,"s":130,"f":"celeb_business"},{"i":2,"s":40,"f":"weird"},{"i":9,"s":90}]}', 2);
    expect(scores.get(0)).toEqual({ score: 100, formatHint: "celeb_business" });
    expect(scores.get(1)).toEqual({ score: 40, formatHint: "trend_list" });
    expect(scores.size).toBe(2);
    expect(parseScores("no json", 2).size).toBe(0);
  });
});

describe("parseDraft", () => {
  it("accepts 7-10 slides and rejects anything outside it", () => {
    expect(parseDraft(draftJson(7))?.slides).toHaveLength(7);
    expect(parseDraft(draftJson(10))?.slides).toHaveLength(10);
    expect(parseDraft(draftJson(6))).toBeNull();
    expect(parseDraft(draftJson(11))).toBeNull();
    expect(parseDraft(draftJson(8, { threadsText: "" }))).toBeNull();
    expect(parseDraft(JSON.stringify({ threadsText: "a", instagramCaption: "b", slides: [{ body: "no headline" }] }))).toBeNull();
  });
});

describe("generateDraft", () => {
  const source = { title: "에레혼 가격 인상", url: "https://a.com/x", formatHint: "celeb_business" };

  it("rewrites once with the compliance issues as feedback", async () => {
    const prompts: string[] = [];
    const answers = [draftJson(8, { threadsText: "불면증 개선 루틴" }), draftJson(8)];
    const result = await generateDraft(source, [], async (prompt) => {
      prompts.push(prompt);
      return answers.shift() ?? "";
    });
    expect(result?.issues).toEqual([]);
    expect(prompts[1]).toContain("이전 초안에서 걸린 문제");
    expect(prompts[1]).toContain("불면증 개선");
  });

  it("returns the flagged draft for human review when the rewrite still trips a rule", async () => {
    const result = await generateDraft(source, [], async () => draftJson(8, { threadsText: "불면증 개선 루틴" }));
    expect(result?.issues.length).toBeGreaterThan(0);
  });

  it("returns null when no attempt parses", async () => {
    expect(await generateDraft(source, [], async () => "sorry")).toBeNull();
  });

  it("puts the format guide and source into the prompt", () => {
    expect(buildDraftPrompt(source)).toContain("셀럽·브랜드 사업 성공기");
    expect(buildDraftPrompt(source)).toContain("https://a.com/x");
  });
});
