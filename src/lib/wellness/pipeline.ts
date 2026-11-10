import type { NewsArticle } from "@/lib/news-rss";
import { prisma } from "@/lib/prisma";
import { kstDayStart } from "@/lib/distribution/scheduler";
import { readProhibitedPhrases } from "@/lib/trend-radar/negative-pattern-learner";
import { fetchFeed, toArticleRow, type ArticleRow } from "@/lib/wellness/articles";
import { readWellnessConfig } from "@/lib/wellness/config";
import { generateDraft, type DraftResult, type DraftSource } from "@/lib/wellness/draft";
import { scoreArticles, type ScoredArticle } from "@/lib/wellness/score";
import { complianceReason } from "@/lib/wellness/slides";

export interface WellnessBrand {
  id: string;
  slug: string;
  brandConfig: string;
}

export interface WellnessDeps {
  fetchFeed: (url: string) => Promise<NewsArticle[]>;
  scoreArticles: (articles: Array<{ title: string }>) => Promise<Map<number, ScoredArticle>>;
  generateDraft: (source: DraftSource, brandPhrases: string[]) => Promise<DraftResult | null>;
}

export interface WellnessRunResult {
  slug: string;
  collected: number;
  scored: number;
  drafted: string[];
  failed: number;
  errors: string[];
}

const SCORE_BATCH = 10; // keeps the judge's JSON answer inside its 300-token budget
const DRAFTING_STALE_MS = 60 * 60 * 1000;

const defaultDeps: WellnessDeps = { fetchFeed, scoreArticles, generateDraft };
const message = (error: unknown) => (error instanceof Error ? error.message : String(error));

export async function runWellnessForBrand(brand: WellnessBrand, now: Date, deps: WellnessDeps = defaultDeps): Promise<WellnessRunResult> {
  const result: WellnessRunResult = { slug: brand.slug, collected: 0, scored: 0, drafted: [], failed: 0, errors: [] };
  const config = readWellnessConfig(brand.brandConfig);
  if (!config) return result;

  // 1. Collect. A feed that fails is reported and skipped; the rest still run.
  const rows = new Map<string, ArticleRow>();
  for (const feed of config.feeds) {
    try {
      for (const article of await deps.fetchFeed(feed)) {
        const row = toArticleRow(article, now, config.maxArticleAgeDays);
        if (row) rows.set(row.urlKey, row);
      }
    } catch (error) {
      result.errors.push(message(error));
    }
  }
  if (rows.size > 0) {
    // skipDuplicates keeps an already-known article (including a rejected one) exactly as it was.
    const inserted = await prisma.sourceArticle.createMany({
      data: [...rows.values()].map((row) => ({ ...row, brandId: brand.id })),
      skipDuplicates: true,
    });
    result.collected = inserted.count;
  }

  // 2. Expire: old candidates stop competing, and a draft that crashed mid-way becomes failed instead of stuck.
  await prisma.sourceArticle.updateMany({
    where: { brandId: brand.id, status: "new", createdAt: { lt: new Date(now.getTime() - config.maxArticleAgeDays * 86_400_000) } },
    data: { status: "skipped" },
  });
  await prisma.sourceArticle.updateMany({
    where: { brandId: brand.id, status: "drafting", updatedAt: { lt: new Date(now.getTime() - DRAFTING_STALE_MS) } },
    data: { status: "failed" },
  });

  // 3. Score the newest unscored candidates.
  const unscored = await prisma.sourceArticle.findMany({
    where: { brandId: brand.id, status: "new", score: null },
    orderBy: { createdAt: "desc" },
    take: SCORE_BATCH,
    select: { id: true, title: true },
  });
  const scores = await deps.scoreArticles(unscored);
  for (const [index, scored] of scores) {
    await prisma.sourceArticle.update({ where: { id: unscored[index].id }, data: { score: scored.score, formatHint: scored.formatHint } });
    result.scored += 1;
  }

  // 4. Draft up to the daily quota. Articles drafted earlier today (in any run) count toward it.
  const draftedToday = await prisma.sourceArticle.count({
    where: { brandId: brand.id, status: { in: ["drafting", "drafted"] }, updatedAt: { gte: kstDayStart(now) } },
  });
  const remaining = config.dailyDrafts - draftedToday;
  if (remaining <= 0) return result;
  const picks = await prisma.sourceArticle.findMany({
    where: { brandId: brand.id, status: "new", score: { gte: config.minScore } },
    orderBy: [{ score: "desc" }, { createdAt: "desc" }],
    take: remaining,
  });
  const brandPhrases = readProhibitedPhrases(brand.brandConfig);

  for (const pick of picks) {
    // Conditional claim: two overlapping runs cannot both draft the same article.
    const claim = await prisma.sourceArticle.updateMany({ where: { id: pick.id, status: "new" }, data: { status: "drafting" } });
    if (claim.count !== 1) continue;
    try {
      const draft = await deps.generateDraft({ title: pick.title, url: pick.url, formatHint: pick.formatHint }, brandPhrases);
      if (!draft) {
        await prisma.sourceArticle.update({ where: { id: pick.id }, data: { status: "failed" } });
        result.failed += 1;
        continue;
      }
      const postId = await prisma.$transaction(async (tx) => {
        const post = await tx.post.create({
          data: {
            brandId: brand.id,
            content: draft.threadsText,
            cardSlides: JSON.stringify(draft.slides),
            instagramCaption: draft.instagramCaption,
            // Never published before a human approves (approval sets PENDING + quality flags).
            status: "NEEDS_REVIEW",
            scheduledAt: now,
            topic: pick.title.slice(0, 200),
            formulaId: `wellness:${pick.formatHint ?? "trend_list"}`,
            qualityPass: draft.issues.length === 0,
            qualityReasons: JSON.stringify(draft.issues.map(complianceReason)),
          },
        });
        await tx.sourceArticle.update({ where: { id: pick.id }, data: { status: "drafted", postId: post.id } });
        return post.id;
      });
      result.drafted.push(postId);
    } catch (error) {
      result.errors.push(message(error));
      result.failed += 1;
      await prisma.sourceArticle.update({ where: { id: pick.id }, data: { status: "failed" } }).catch(() => undefined);
    }
  }
  return result;
}
