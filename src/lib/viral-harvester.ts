/**
 * Viral Harvester
 * Collects, deduplicates, and filters viral posts across keywords, profiles, and owned history
 */

import crypto from "crypto";
import { fetchPublicProfilePosts, searchThreadsByKeyword, type ThreadsPublicPost } from "@/lib/threads-api";
import type { ViralAdapterId, ViralSourceError } from "@/types/viral";

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
  keywords?: string[];
  handles?: string[];
  excludedTerms?: string[];
  maxPerSource?: number;
  requestDelayMs?: number;
}

export interface HarvestResult {
  candidates: HarvestedCandidate[];
  errors: ViralSourceError[];
  totalDiscovered: number;
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

export async function harvestFromThreadsSources(options: HarvestOptions): Promise<HarvestResult> {
  const {
    accessToken,
    keywords = [],
    handles = [],
    excludedTerms = [],
    maxPerSource = 15,
    requestDelayMs = 400,
  } = options;

  const rawCandidates: HarvestedCandidate[] = [];
  const errors: ViralSourceError[] = [];

  if (!accessToken) {
    return {
      candidates: [],
      errors: [{ adapter: "threads_keyword", source: "auth", message: "Threads access token is missing" }],
      totalDiscovered: 0,
    };
  }

  // 1. Keyword search
  for (const keyword of keywords.slice(0, 5)) {
    try {
      const posts = await searchThreadsByKeyword(accessToken, keyword, maxPerSource);
      for (const post of posts) {
        const candidate = convertThreadsPostToCandidate(post, "threads_keyword", `keyword:${keyword}`, { keyword });
        if (candidate && !isContentExcluded(candidate.content, excludedTerms)) {
          rawCandidates.push(candidate);
        }
      }
      if (requestDelayMs > 0) {
        await new Promise((res) => setTimeout(res, requestDelayMs));
      }
    } catch (err) {
      errors.push({
        adapter: "threads_keyword",
        source: keyword,
        message: err instanceof Error ? err.message : "Keyword search error",
      });
    }
  }

  // 2. Profile posts
  for (const handle of handles.slice(0, 5)) {
    try {
      const posts = await fetchPublicProfilePosts(accessToken, handle, maxPerSource);
      for (const post of posts) {
        const candidate = convertThreadsPostToCandidate(post, "threads_profile", `profile:@${handle}`, { handle });
        if (candidate && !isContentExcluded(candidate.content, excludedTerms)) {
          rawCandidates.push(candidate);
        }
      }
      if (requestDelayMs > 0) {
        await new Promise((res) => setTimeout(res, requestDelayMs));
      }
    } catch (err) {
      errors.push({
        adapter: "threads_profile",
        source: handle,
        message: err instanceof Error ? err.message : "Profile posts error",
      });
    }
  }

  const unique = deduplicateHarvestedCandidates(rawCandidates);

  return {
    candidates: unique,
    errors,
    totalDiscovered: rawCandidates.length,
  };
}
