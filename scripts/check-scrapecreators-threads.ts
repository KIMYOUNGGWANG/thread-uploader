/**
 * 0단계 게이트 (docs/superpowers/specs/2026-11-05-scrapecreators-threads-adapter-design.md 3장).
 * ScrapeCreators Threads 엔드포인트를 최대 4번(4크레딧) 호출해 필드만 출력한다. DB는 읽지도 쓰지도 않는다.
 *
 *   SCRAPECREATORS_API_KEY=sk_... npx tsx scripts/check-scrapecreators-threads.ts \
 *     --keyword=사주 --handle=<경쟁 계정> [--permalink=<같은 글의 공식 API permalink>]
 */
import { existsSync } from "node:fs";
import {
  SCRAPECREATORS_BASE_URL,
  extractThreadsShortcode,
  parseThreadsResponse,
} from "../src/lib/scrapecreators/threads-client";

if (existsSync(".env")) process.loadEnvFile(".env");

function arg(name: string): string | null {
  const match = process.argv.find((value) => value.startsWith(`--${name}=`));
  return match ? match.slice(name.length + 3) : null;
}

type Json = Record<string, unknown>;

async function call(apiKey: string, path: string, params: Record<string, string>): Promise<Json> {
  const res = await fetch(`${SCRAPECREATORS_BASE_URL}${path}?${new URLSearchParams(params)}`, {
    headers: { "x-api-key": apiKey },
    signal: AbortSignal.timeout(30_000),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${path} ${res.status}: ${text.slice(0, 300)}`);
  return JSON.parse(text) as Json;
}

function describe(label: string, body: Json, startDate?: Date) {
  const rawPosts = Array.isArray(body.posts) ? (body.posts as Json[]) : [];
  const { posts, creditsRemaining } = parseThreadsResponse(body);
  console.log(`\n[${label}] raw ${rawPosts.length} / parsed ${posts.length}, credits_remaining=${creditsRemaining ?? "?"}`);
  const first = rawPosts[0];
  if (first) {
    console.log(`  post keys: ${Object.keys(first).sort().join(", ")}`);
    const info = first.text_post_app_info;
    console.log(`  text_post_app_info keys: ${info && typeof info === "object" ? Object.keys(info).sort().join(", ") : "(none)"}`);
  }
  const withLikes = posts.filter((post) => post.likeCount !== null).length;
  const withReplies = posts.filter((post) => post.replyCount !== null).length;
  console.log(`  like_count ${withLikes}/${posts.length}, reply count ${withReplies}/${posts.length}`);
  const oldest = posts.reduce<Date | null>((min, post) => (post.takenAt && (!min || post.takenAt < min) ? post.takenAt : min), null);
  if (startDate) {
    console.log(`  start_date=${startDate.toISOString().slice(0, 10)}, oldest taken_at=${oldest?.toISOString() ?? "?"} → ${oldest && oldest < startDate ? "필터 안 먹음" : "ok"}`);
  }
  posts.slice(0, 5).forEach((post, index) => {
    console.log(`  ${index + 1}. @${post.username} ♥${post.likeCount ?? "?"} ${post.takenAt?.toISOString().slice(0, 16) ?? "?"} ${post.code} ${post.text.slice(0, 40).replace(/\n/g, " ")}`);
  });
  return posts;
}

async function main() {
  const apiKey = process.env.SCRAPECREATORS_API_KEY?.trim();
  if (!apiKey) throw new Error("SCRAPECREATORS_API_KEY is not set");
  const keyword = arg("keyword") ?? "사주";
  const handle = arg("handle");
  const permalink = arg("permalink");

  const plain = await call(apiKey, "/v1/threads/search", { query: keyword });
  describe(`1. search "${keyword}"`, plain);

  const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const filtered = await call(apiKey, "/v1/threads/search", { query: keyword, start_date: startDate.toISOString().slice(0, 10) });
  describe(`2. search "${keyword}" + start_date`, filtered, startDate);

  if (handle) {
    describe(`3. user/posts @${handle}`, await call(apiKey, "/v1/threads/user/posts", { handle: handle.replace(/^@/, "") }));
  } else {
    console.log("\n[3. user/posts] --handle 없음, 건너뜀");
  }

  if (permalink) {
    const code = extractThreadsShortcode(permalink);
    const post = await call(apiKey, "/v1/threads/post", { url: permalink });
    const scCode = extractThreadsShortcode(JSON.stringify(post).match(/https:\/\/www\.threads\.(?:com|net)\/@[^"]+\/post\/[A-Za-z0-9_-]+/)?.[0]) ?? null;
    console.log(`\n[5. shortcode] official permalink → ${code}, ScrapeCreators /v1/threads/post → ${scCode ?? "(url 없음)"} → ${code && code === scCode ? "일치" : "확인 필요"}`);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
