import crypto from "crypto";
import { parseRssXml, type NewsArticle } from "@/lib/news-rss";

export interface ArticleRow {
  url: string;
  urlKey: string;
  title: string;
  publishedAt: Date | null;
}

const TRACKING_PARAM = /^(utm_[a-z]+|fbclid|gclid|mc_cid|mc_eid|ref|ref_src)$/i;

// Same article must map to the same key regardless of tracking params, scheme, host case, fragment or trailing slash.
export function normalizeUrl(raw: string): string {
  const trimmed = raw.trim();
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return trimmed;
  }
  url.protocol = "https:";
  url.hostname = url.hostname.toLowerCase().replace(/^www\./, "");
  url.hash = "";
  for (const key of [...url.searchParams.keys()]) {
    if (TRACKING_PARAM.test(key)) url.searchParams.delete(key);
  }
  url.searchParams.sort();
  if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, "");
  return url.toString();
}

export function urlKeyOf(raw: string): string {
  return crypto.createHash("sha256").update(normalizeUrl(raw)).digest("hex");
}

// Postgres TEXT rejects NUL; feeds occasionally carry it.
export function sanitizeText(value: string, maxLength: number): string {
  return value.replace(/\u0000/g, "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

export function toArticleRow(article: NewsArticle, now: Date, maxAgeDays: number): ArticleRow | null {
  const title = sanitizeText(article.cleanTitle || article.title, 300);
  const url = sanitizeText(article.link, 2000);
  if (!title || !/^https?:\/\//.test(url)) return null;
  const published = new Date(article.pubDate);
  const publishedAt = Number.isNaN(published.getTime()) ? null : published;
  if (publishedAt && now.getTime() - publishedAt.getTime() > maxAgeDays * 24 * 60 * 60 * 1000) return null;
  return { url, urlKey: urlKeyOf(url), title, publishedAt };
}

export async function fetchFeed(feedUrl: string, limit = 30): Promise<NewsArticle[]> {
  const response = await fetch(feedUrl, {
    headers: { "User-Agent": "PortfolioGrowthOS/1.0 (+rss reader)" },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`RSS ${response.status}: ${feedUrl}`);
  return parseRssXml(await response.text(), limit);
}
