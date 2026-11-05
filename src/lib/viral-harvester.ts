/**
 * Viral Harvester
 * Collects, deduplicates, and filters viral posts across keywords, profiles, and owned history
 */

import crypto from "crypto";
import { fetchPublicProfilePosts, searchThreadsByKeyword, type ThreadsPublicPost } from "@/lib/threads-api";
import { SOURCE_MAX_AGE_DAYS } from "@/lib/reference-radar";
import type { ScrapeCreatorsThreadsClient, ScrapeCreatorsThreadsPost } from "@/lib/scrapecreators/threads-client";
import type { ViralAdapterId, ViralSourceError } from "@/types/viral";

const MAX_KEYWORDS = 10;
const MAX_HANDLES = 5;

export interface HarvestedCandidate {
  adapter: ViralAdapterId;
  source: string;
  sourceKey: string;
  contentHash: string;
  authorUsername: string | null;
  permalink: string | null;
  content: string;
  publishedAt: Date | null;
  views: number | null;
  likes: number | null;
  replies: number | null;
  reposts: number | null;
  quotes: number | null;
  shares: number | null;
  rawMetrics: Record<string, string | number | boolean | null>;
}

export interface HarvestOptions {
  accessToken?: string | null;
  /** When set, keyword and profile sources go through ScrapeCreators instead of the official API. */
  scrapeCreators?: ScrapeCreatorsThreadsClient | null;
  keywords?: string[];
  handles?: string[];
  excludedTerms?: string[];
  maxPerSource?: number;
  requestDelayMs?: number;
  now?: Date;
}

export interface HarvestResult {
  candidates: HarvestedCandidate[];
  errors: ViralSourceError[];
  totalDiscovered: number;
  /** Keyword + profile sources actually queried; each failure adds exactly one error. */
  attemptedSources: number;
  /** Lowest ScrapeCreators credit balance reported during the run; null when it was not used. */
  creditsRemaining: number | null;
}

/** True when external sources were tried and none came back (e.g. missing Threads app permission). */
export function allExternalSourcesFailed(result: Pick<HarvestResult, "attemptedSources" | "errors">): boolean {
  return result.attemptedSources > 0 && result.errors.length >= result.attemptedSources;
}

export function hashContent(content: string): string {
  const normalized = content.replace(/\s+/g, " ").trim().toLowerCase();
  return crypto.createHash("sha256").update(normalized).digest("hex").slice(0, 24);
}

export function isContentExcluded(content: string, excludedTerms: string[] = []): boolean {
  if (excludedTerms.length === 0) return false;
  const lower = content.toLowerCase();
  return excludedTerms.some((term) => term.trim() && lower.includes(term.trim().toLowerCase()));
}

export function deduplicateHarvestedCandidates(candidates: HarvestedCandidate[]): HarvestedCandidate[] {
  const seenHashes = new Set<string>();
  const seenSourceKeys = new Set<string>();
  const unique: HarvestedCandidate[] = [];

  for (const item of candidates) {
    const sourceIdentifier = `${item.source}:${item.sourceKey}`;
    if (seenSourceKeys.has(sourceIdentifier) || seenHashes.has(item.contentHash)) {
      continue;
    }
    seenSourceKeys.add(sourceIdentifier);
    seenHashes.add(item.contentHash);
    unique.push(item);
  }

  return unique;
}

/** Before dedupe: count how many keyword searches surfaced each post and keep its best rank. */
export function annotateSearchSignals(candidates: HarvestedCandidate[]): HarvestedCandidate[] {
  const hits = new Map<string, { count: number; bestRank: number }>();
  for (const item of candidates) {
    const rank = item.rawMetrics.searchRank;
    if (typeof rank !== "number") continue;
    const seen = hits.get(item.sourceKey);
    hits.set(item.sourceKey, { count: (seen?.count ?? 0) + 1, bestRank: Math.min(seen?.bestRank ?? rank, rank) });
  }
  return candidates.map((item) => {
    const signal = hits.get(item.sourceKey);
    if (!signal) return item;
    return { ...item, rawMetrics: { ...item.rawMetrics, searchRank: signal.bestRank, keywordHits: signal.count } };
  });
}

export function convertThreadsPostToCandidate(
  post: ThreadsPublicPost,
  adapter: ViralAdapterId,
  source: string,
  context: Record<string, string> = {}
): HarvestedCandidate | null {
  const text = (post.text ?? "").trim();
  if (!text) return null;

  return {
    adapter,
    source,
    sourceKey: post.id,
    contentHash: hashContent(text),
    authorUsername: post.username ?? null,
    permalink: post.permalink ?? null,
    content: text,
    publishedAt: post.timestamp ? new Date(post.timestamp) : null,
    views: null,
    likes: null,
    replies: null,
    reposts: null,
    quotes: null,
    shares: null,
    rawMetrics: {
      ...context,
      hasReplies: post.has_replies ?? null,
      isQuotePost: post.is_quote_post ?? null,
      topicTag: post.topic_tag ?? null,
    },
  };
}

export function convertScrapeCreatorsPostToCandidate(
  post: ScrapeCreatorsThreadsPost,
  source: string,
  context: Record<string, string> = {}
): HarvestedCandidate | null {
  const text = post.text.trim();
  if (!text) return null;

  return {
    adapter: "threads_scrapecreators",
    source,
    // Shortcode, not pk: it is the only id the official API's permalink shares, so both providers can key the same post alike.
    sourceKey: post.code,
    contentHash: hashContent(text),
    authorUsername: post.username,
    permalink: post.url,
    content: text,
    publishedAt: post.takenAt,
    views: null,
    likes: post.likeCount,
    replies: post.replyCount,
    reposts: post.repostCount,
    quotes: post.quoteCount,
    shares: null,
    rawMetrics: {
      ...context,
      provider: "scrapecreators",
      scPk: post.pk,
      likeCount: post.likeCount,
      // Same meaning as the official has_replies flag, which referenceScore already rewards.
      hasReplies: post.replyCount === null ? null : post.replyCount > 0,
    },
  };
}

interface SourceRun {
  candidates: HarvestedCandidate[];
  errors: ViralSourceError[];
  attemptedSources: number;
}

interface SourceRunOptions {
  keywords: string[];
  handles: string[];
  excludedTerms: string[];
  maxPerSource: number;
  requestDelayMs: number;
}

async function pause(ms: number) {
  if (ms > 0) await new Promise((res) => setTimeout(res, ms));
}

async function runOfficialSources(accessToken: string, options: SourceRunOptions): Promise<SourceRun> {
  const { keywords, handles, excludedTerms, maxPerSource, requestDelayMs } = options;
  const candidates: HarvestedCandidate[] = [];
  const errors: ViralSourceError[] = [];

  // 1. Keyword search
  for (const keyword of keywords) {
    try {
      const posts = await searchThreadsByKeyword(accessToken, keyword, maxPerSource);
      posts.forEach((post, index) => {
        const candidate = convertThreadsPostToCandidate(post, "threads_keyword", `keyword:${keyword}`, { keyword });
        if (candidate && !isContentExcluded(candidate.content, excludedTerms)) {
          candidate.rawMetrics.searchRank = index + 1; // TOP search order
          candidates.push(candidate);
        }
      });
      await pause(requestDelayMs);
    } catch (err) {
      errors.push({
        adapter: "threads_keyword",
        source: keyword,
        message: err instanceof Error ? err.message : "Keyword search error",
      });
    }
  }

  // 2. Profile posts
  for (const handle of handles) {
    try {
      const posts = await fetchPublicProfilePosts(accessToken, handle, maxPerSource);
      for (const post of posts) {
        const candidate = convertThreadsPostToCandidate(post, "threads_profile", `profile:@${handle}`, { handle });
        if (candidate && !isContentExcluded(candidate.content, excludedTerms)) {
          candidates.push(candidate);
        }
      }
      await pause(requestDelayMs);
    } catch (err) {
      errors.push({
        adapter: "threads_profile",
        source: handle,
        message: err instanceof Error ? err.message : "Profile posts error",
      });
    }
  }

  return { candidates, errors, attemptedSources: keywords.length + handles.length };
}

async function runScrapeCreatorsSources(
  client: ScrapeCreatorsThreadsClient,
  options: SourceRunOptions & { now: Date },
  onCredits: (remaining: number | null) => void
): Promise<SourceRun> {
  const { keywords, handles, excludedTerms, maxPerSource, requestDelayMs, now } = options;
  const candidates: HarvestedCandidate[] = [];
  const errors: ViralSourceError[] = [];
  // ref_replay only takes posts from the last SOURCE_MAX_AGE_DAYS, so older search hits would only cost storage.
  const startDate = new Date(now.getTime() - SOURCE_MAX_AGE_DAYS * 24 * 60 * 60 * 1000);

  for (const keyword of keywords) {
    try {
      const { posts, creditsRemaining } = await client.search(keyword, { startDate });
      onCredits(creditsRemaining);
      posts.slice(0, maxPerSource).forEach((post, index) => {
        const candidate = convertScrapeCreatorsPostToCandidate(post, `keyword:${keyword}`, { keyword });
        if (candidate && !isContentExcluded(candidate.content, excludedTerms)) {
          candidate.rawMetrics.searchRank = index + 1; // response order stands in for the TOP rank, as with the official search
          candidates.push(candidate);
        }
      });
      await pause(requestDelayMs);
    } catch (err) {
      errors.push({
        adapter: "threads_scrapecreators",
        source: keyword,
        message: err instanceof Error ? err.message : "ScrapeCreators search error",
      });
    }
  }

  for (const handle of handles) {
    try {
      const { posts, creditsRemaining } = await client.userPosts(handle);
      onCredits(creditsRemaining);
      for (const post of posts.slice(0, maxPerSource)) {
        const candidate = convertScrapeCreatorsPostToCandidate(post, `profile:@${handle}`, { handle });
        if (candidate && !isContentExcluded(candidate.content, excludedTerms)) {
          candidates.push(candidate);
        }
      }
      await pause(requestDelayMs);
    } catch (err) {
      errors.push({
        adapter: "threads_scrapecreators",
        source: `@${handle}`,
        message: err instanceof Error ? err.message : "ScrapeCreators profile error",
      });
    }
  }

  return { candidates, errors, attemptedSources: keywords.length + handles.length };
}

export async function harvestFromThreadsSources(options: HarvestOptions): Promise<HarvestResult> {
  const {
    accessToken,
    scrapeCreators = null,
    keywords = [],
    handles = [],
    excludedTerms = [],
    maxPerSource = 15,
    requestDelayMs = 400,
    now = new Date(),
  } = options;

  if (!accessToken && !scrapeCreators) {
    return {
      candidates: [],
      errors: [{ adapter: "threads_keyword", source: "auth", message: "Threads access token is missing" }],
      totalDiscovered: 0,
      attemptedSources: 0,
      creditsRemaining: null,
    };
  }

  const runOptions: SourceRunOptions = {
    keywords: keywords.slice(0, MAX_KEYWORDS),
    handles: handles.slice(0, MAX_HANDLES),
    excludedTerms,
    maxPerSource,
    requestDelayMs,
  };
  const runs: SourceRun[] = [];
  let creditsRemaining: number | null = null;

  // ScrapeCreators replaces the official calls: until Meta app review the official keyword search returns only our own posts.
  if (scrapeCreators) {
    const scRun = await runScrapeCreatorsSources(scrapeCreators, { ...runOptions, now }, (remaining) => {
      if (remaining !== null) creditsRemaining = creditsRemaining === null ? remaining : Math.min(creditsRemaining, remaining);
    });
    runs.push(scRun);
    // Every paid call failed (bad key, no credits, outage): fall back to the official search in the same run.
    if (accessToken && allExternalSourcesFailed(scRun)) {
      runs.push(await runOfficialSources(accessToken, runOptions));
    }
  } else if (accessToken) {
    runs.push(await runOfficialSources(accessToken, runOptions));
  }

  const rawCandidates = runs.flatMap((run) => run.candidates);
  const unique = deduplicateHarvestedCandidates(annotateSearchSignals(rawCandidates));

  return {
    candidates: unique,
    errors: runs.flatMap((run) => run.errors),
    totalDiscovered: rawCandidates.length,
    attemptedSources: runs.reduce((sum, run) => sum + run.attemptedSources, 0),
    creditsRemaining,
  };
}
