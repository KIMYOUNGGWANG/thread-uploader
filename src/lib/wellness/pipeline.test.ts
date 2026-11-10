import { beforeEach, describe, expect, it, vi } from "vitest";

// Small in-memory SourceArticle/Post store that understands only the where-shapes the pipeline uses.
type Row = Record<string, unknown> & { id: string; brandId: string; urlKey: string; status: string; createdAt: Date; updatedAt: Date };
const db = vi.hoisted(() => ({ articles: [] as Row[], posts: [] as Record<string, unknown>[], seq: 0, now: new Date(0) }));

const matches = (row: Row, where: Record<string, unknown>): boolean =>
  Object.entries(where).every(([key, cond]) => {
    const value = row[key];
    if (cond === null) return value === null || value === undefined;
    if (typeof cond === "object" && !(cond instanceof Date)) {
      const c = cond as { in?: unknown[]; lt?: Date; gte?: unknown };
      if (c.in) return c.in.includes(value);
      if (c.lt) return (value as Date) < c.lt;
      if (c.gte !== undefined) return value !== null && value !== undefined && (value as number | Date) >= (c.gte as number | Date);
    }
    return value === cond;
  });

vi.mock("@/lib/prisma", () => {
  const sourceArticle = {
    createMany: vi.fn(async ({ data }: { data: Row[] }) => {
      let count = 0;
      for (const row of data) {
        if (db.articles.some((a) => a.brandId === row.brandId && a.urlKey === row.urlKey)) continue;
        db.articles.push({ score: null, formatHint: null, postId: null, ...row, id: `a${++db.seq}`, status: "new", createdAt: db.now, updatedAt: db.now });
        count += 1;
      }
      return { count };
    }),
    updateMany: vi.fn(async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
      const hit = db.articles.filter((a) => matches(a, where));
      hit.forEach((a) => Object.assign(a, data, { updatedAt: db.now }));
      return { count: hit.length };
    }),
    update: vi.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
      const row = db.articles.find((a) => a.id === where.id);
      if (!row) throw new Error("not found");
      return Object.assign(row, data, { updatedAt: db.now });
    }),
    findMany: vi.fn(async ({ where, take }: { where: Record<string, unknown>; take: number }) =>
      db.articles
        .filter((a) => matches(a, where))
        .sort((x, y) => ((y.score as number) ?? 0) - ((x.score as number) ?? 0))
        .slice(0, take)),
    count: vi.fn(async ({ where }: { where: Record<string, unknown> }) => db.articles.filter((a) => matches(a, where)).length),
  };
  const post = { create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => { const row = { id: `p${++db.seq}`, ...data }; db.posts.push(row); return row; }) };
  return { prisma: { sourceArticle, post, $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn({ sourceArticle, post })) } };
});

import { runWellnessForBrand, type WellnessDeps } from "@/lib/wellness/pipeline";
import type { ScoredArticle } from "@/lib/wellness/score";

const brand = {
  id: "b1",
  slug: "wellness-media",
  brandConfig: JSON.stringify({ wellness: { feeds: ["https://feed.test/rss"], dailyDrafts: 2 }, fidelity: { prohibitedPhrases: ["기적의"] } }),
};
const item = (n: number) => ({ id: `${n}`, title: `기사 ${n}`, cleanTitle: `기사 ${n}`, source: "S", link: `https://news.test/${n}?utm_source=rss`, pubDate: "Mon, 09 Nov 2026 10:00:00 GMT" });
const slides = Array.from({ length: 8 }, (_, i) => ({ headline: `카드 ${i + 1}` }));

function deps(overrides: Partial<WellnessDeps> = {}): WellnessDeps {
  return {
    fetchFeed: vi.fn(async () => [item(1), item(2), item(3)]),
    scoreArticles: vi.fn(async (articles: Array<{ title: string }>) =>
      new Map(articles.map((_, i): [number, ScoredArticle] => [i, { score: 90 - i, formatHint: "celeb_business" }]))),
    generateDraft: vi.fn(async () => ({ threadsText: "스레드", instagramCaption: "캡션", slides, issues: [] })),
    ...overrides,
  };
}

beforeEach(() => {
  db.articles = [];
  db.posts = [];
  db.seq = 0;
  db.now = new Date("2026-11-09T21:00:00Z"); // KST 11-10 06:00
});

describe("runWellnessForBrand", () => {
  it("skips brands without wellness config", async () => {
    const d = deps();
    const result = await runWellnessForBrand({ ...brand, brandConfig: "{}" }, db.now, d);
    expect(result.drafted).toEqual([]);
    expect(d.fetchFeed).not.toHaveBeenCalled();
  });

  it("collects, scores and drafts the top N as NEEDS_REVIEW posts with card slides", async () => {
    const d = deps();
    const result = await runWellnessForBrand(brand, db.now, d);
    expect(result.collected).toBe(3);
    expect(result.drafted).toHaveLength(2);
    expect(db.posts.map((p) => p.status)).toEqual(["NEEDS_REVIEW", "NEEDS_REVIEW"]);
    expect(JSON.parse(db.posts[0].cardSlides as string)).toHaveLength(8);
    expect(db.posts[0].instagramCaption).toBe("캡션");
    expect(vi.mocked(d.generateDraft).mock.calls[0][1]).toEqual(["기적의"]);
    expect(db.articles.filter((a) => a.status === "drafted").map((a) => a.postId)).toEqual(result.drafted);
  });

  it("never re-drafts an article after its post was rejected (deleted)", async () => {
    await runWellnessForBrand(brand, db.now, deps());
    db.posts = []; // operator rejected both drafts
    db.now = new Date("2026-11-10T21:00:00Z"); // next day, same feed items still listed
    const d = deps();
    const result = await runWellnessForBrand(brand, db.now, d);
    expect(result.collected).toBe(0);
    const draftedTitles = vi.mocked(d.generateDraft).mock.calls.map(([source]) => source.title);
    expect(draftedTitles).toEqual(["기사 3"]);
  });

  it("respects the daily quota across runs on the same KST day", async () => {
    await runWellnessForBrand(brand, db.now, deps());
    const d = deps({ fetchFeed: vi.fn(async () => [item(4), item(5)]) });
    const result = await runWellnessForBrand(brand, new Date(db.now.getTime() + 60_000), d);
    expect(result.drafted).toEqual([]);
    expect(d.generateDraft).not.toHaveBeenCalled();
  });

  it("does not draft an article another run already claimed", async () => {
    await runWellnessForBrand(brand, db.now, deps({ generateDraft: vi.fn(async () => null) }));
    expect(db.articles.filter((a) => a.status === "failed")).toHaveLength(2);
    db.articles[2].status = "drafting"; // a concurrent run holds it
    db.now = new Date("2026-11-10T21:00:00Z");
    const d = deps();
    await runWellnessForBrand(brand, db.now, d);
    expect(d.generateDraft).not.toHaveBeenCalled();
  });

  it("marks the article failed when drafting throws and keeps going", async () => {
    const generate = vi.fn().mockRejectedValueOnce(new Error("LLM down")).mockResolvedValue({ threadsText: "t", instagramCaption: "c", slides, issues: ["질병 치료·예방 표현"] });
    const result = await runWellnessForBrand(brand, db.now, deps({ generateDraft: generate }));
    expect(result.errors).toContain("LLM down");
    expect(result.drafted).toHaveLength(1);
    expect(db.posts[0].qualityPass).toBe(false);
    expect(db.articles.find((a) => a.title === "기사 1")?.status).toBe("failed");
  });

  it("reports a broken feed without stopping the run", async () => {
    const result = await runWellnessForBrand(brand, db.now, deps({ fetchFeed: vi.fn().mockRejectedValue(new Error("RSS 500")) }));
    expect(result.errors).toEqual(["RSS 500"]);
    expect(result.drafted).toEqual([]);
  });
});
