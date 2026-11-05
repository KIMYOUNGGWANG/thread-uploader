/**
 * ScrapeCreators Threads client.
 * The official Threads API returns only the token owner's posts from keyword search until Meta app review,
 * and never returns other accounts' like counts. ScrapeCreators returns public posts with like_count.
 * Design: docs/superpowers/specs/2026-11-05-scrapecreators-threads-adapter-design.md
 */

export const SCRAPECREATORS_BASE_URL = "https://api.scrapecreators.com";
const DEFAULT_TIMEOUT_MS = 20_000;

export interface ScrapeCreatorsThreadsPost {
  /** Shortcode from the post URL (`/post/<code>`); the only id shared with the official API's permalink. */
  code: string;
  pk: string | null;
  text: string;
  username: string | null;
  url: string | null;
  takenAt: Date | null;
  likeCount: number | null;
  replyCount: number | null;
  repostCount: number | null;
  quoteCount: number | null;
}

export interface ScrapeCreatorsThreadsResponse {
  posts: ScrapeCreatorsThreadsPost[];
  creditsRemaining: number | null;
}

export interface ScrapeCreatorsThreadsClient {
  search(query: string, options?: { startDate?: Date }): Promise<ScrapeCreatorsThreadsResponse>;
  userPosts(handle: string): Promise<ScrapeCreatorsThreadsResponse>;
}

type Json = Record<string, unknown>;

function rec(value: unknown): Json {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Json) : {};
}

function str(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function count(value: unknown): number | null {
  const parsed = typeof value === "string" && value.trim() ? Number(value) : value;
  return typeof parsed === "number" && Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed) : null;
}

/** First numeric value among candidate fields; the documented example only shows like_count, so reply/repost fields are read defensively. */
function firstCount(...values: unknown[]): number | null {
  for (const value of values) {
    const parsed = count(value);
    if (parsed !== null) return parsed;
  }
  return null;
}

export function extractThreadsShortcode(url: string | null | undefined): string | null {
  if (!url) return null;
  const match = /\/post\/([A-Za-z0-9_-]+)/.exec(url);
  return match ? match[1] : null;
}

function parseTakenAt(value: unknown): Date | null {
  const seconds = count(value);
  if (seconds === null || seconds === 0) return null;
  const date = new Date(seconds * 1000);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function parseThreadsPost(item: unknown): ScrapeCreatorsThreadsPost | null {
  const post = rec(item);
  const user = rec(post.user);
  const url = str(post.url);
  const code = str(post.code) ?? extractThreadsShortcode(url);
  const text = str(rec(post.caption).text) ?? str(post.text);
  if (!code || !text) return null;

  const username = str(user.username);
  const info = rec(post.text_post_app_info);
  return {
    code,
    pk: str(post.pk),
    text,
    username,
    url: url ?? (username ? `https://www.threads.com/@${username}/post/${code}` : null),
    takenAt: parseTakenAt(post.taken_at),
    likeCount: count(post.like_count),
    replyCount: firstCount(info.direct_reply_count, post.direct_reply_count, post.reply_count),
    repostCount: firstCount(info.repost_count, post.repost_count),
    quoteCount: firstCount(info.quote_count, post.quote_count),
  };
}

/** Malformed rows are dropped one by one so a single broken post does not lose the rest of the page. */
export function parseThreadsResponse(json: unknown): ScrapeCreatorsThreadsResponse {
  const body = rec(json);
  if (body.success === false) {
    throw new Error(`scrapecreators: ${str(body.message) ?? str(body.error) ?? "request failed"}`);
  }
  const rawPosts = Array.isArray(body.posts) ? body.posts : [];
  return {
    posts: rawPosts.map(parseThreadsPost).filter((post): post is ScrapeCreatorsThreadsPost => post !== null),
    creditsRemaining: count(body.credits_remaining),
  };
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function getScrapeCreatorsApiKey(): string | null {
  const key = process.env.SCRAPECREATORS_API_KEY?.trim();
  return key ? key : null;
}

export function createScrapeCreatorsThreadsClient(
  apiKey: string,
  fetchImpl: typeof fetch = fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS
): ScrapeCreatorsThreadsClient {
  async function call(path: string, params: Record<string, string>): Promise<ScrapeCreatorsThreadsResponse> {
    const query = new URLSearchParams(params);
    const res = await fetchImpl(`${SCRAPECREATORS_BASE_URL}${path}?${query}`, {
      headers: { "x-api-key": apiKey },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`scrapecreators ${path} ${res.status}${body ? `: ${body.slice(0, 200)}` : ""}`);
    }
    return parseThreadsResponse(await res.json());
  }

  return {
    search(query, options = {}) {
      const params: Record<string, string> = { query };
      if (options.startDate) params.start_date = formatDate(options.startDate);
      return call("/v1/threads/search", params);
    },
    userPosts(handle) {
      return call("/v1/threads/user/posts", { handle: handle.replace(/^@/, "") });
    },
  };
}
