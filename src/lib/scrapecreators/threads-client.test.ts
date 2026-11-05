import { describe, expect, it, vi } from "vitest";
import {
  createScrapeCreatorsThreadsClient,
  extractThreadsShortcode,
  parseThreadsResponse,
} from "./threads-client";

// Trimmed from the documented example at docs.scrapecreators.com/v1/threads/search/openapi.json (2026-11-05).
const DOC_EXAMPLE = {
  success: true,
  credits_remaining: 1000000,
  credits_charged: 1,
  posts: [
    {
      id: "3658605407757558624_71259204903",
      pk: "3658605407757558624",
      caption: { text: "This woman selling mini umbrellas shows love to stray cats", pk: "18077403781726333" },
      code: "DLF-jv2tmNg",
      like_count: 5419,
      taken_at: 1750359780,
      user: { pk: "71259204903", username: "mahtabuddinit", id: "71259204903" },
    },
  ],
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("parseThreadsResponse", () => {
  it("maps the documented search example", () => {
    const { posts, creditsRemaining } = parseThreadsResponse(DOC_EXAMPLE);

    expect(creditsRemaining).toBe(1000000);
    expect(posts).toEqual([
      {
        code: "DLF-jv2tmNg",
        pk: "3658605407757558624",
        text: "This woman selling mini umbrellas shows love to stray cats",
        username: "mahtabuddinit",
        url: "https://www.threads.com/@mahtabuddinit/post/DLF-jv2tmNg",
        takenAt: new Date(1750359780 * 1000),
        likeCount: 5419,
        replyCount: null,
        repostCount: null,
        quoteCount: null,
      },
    ]);
  });

  it("reads reply/repost/quote counts from text_post_app_info when present", () => {
    const post = {
      ...DOC_EXAMPLE.posts[0],
      url: "https://www.threads.com/@x/post/DLF-jv2tmNg",
      text_post_app_info: { direct_reply_count: 12, repost_count: "3", quote_count: 1 },
    };
    const [parsed] = parseThreadsResponse({ posts: [post] }).posts;

    expect(parsed).toMatchObject({ replyCount: 12, repostCount: 3, quoteCount: 1, url: "https://www.threads.com/@x/post/DLF-jv2tmNg" });
  });

  it("drops broken rows one by one and keeps the rest", () => {
    const { posts, creditsRemaining } = parseThreadsResponse({
      posts: [
        null,
        { code: "noText" },
        { caption: { text: "no code or url" } },
        { caption: { text: "code from url" }, url: "https://www.threads.net/@a/post/ABC_123" },
        { ...DOC_EXAMPLE.posts[0], like_count: -1, taken_at: "bad" },
      ],
    });

    expect(creditsRemaining).toBeNull();
    expect(posts.map((post) => post.code)).toEqual(["ABC_123", "DLF-jv2tmNg"]);
    expect(posts[1]).toMatchObject({ likeCount: null, takenAt: null });
  });

  it("throws when the API reports success: false", () => {
    expect(() => parseThreadsResponse({ success: false, message: "Out of credits" })).toThrow("Out of credits");
  });
});

describe("extractThreadsShortcode", () => {
  it("pulls the shortcode from threads.com and threads.net permalinks", () => {
    expect(extractThreadsShortcode("https://www.threads.com/@zuck/post/DK-BydcJHkF")).toBe("DK-BydcJHkF");
    expect(extractThreadsShortcode("https://www.threads.net/@zuck/post/DK-BydcJHkF?xmt=1")).toBe("DK-BydcJHkF");
    expect(extractThreadsShortcode("https://www.threads.com/@zuck")).toBeNull();
    expect(extractThreadsShortcode(null)).toBeNull();
  });
});

describe("createScrapeCreatorsThreadsClient", () => {
  it("sends the key header and the search params", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(DOC_EXAMPLE));
    const client = createScrapeCreatorsThreadsClient("sk_test", fetchImpl as unknown as typeof fetch);

    await client.search("사주 궁합", { startDate: new Date("2026-10-29T15:00:00Z") });
    await client.userPosts("@the.saju");

    const [searchUrl, searchInit] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    const url = new URL(searchUrl);
    expect(url.origin + url.pathname).toBe("https://api.scrapecreators.com/v1/threads/search");
    expect(url.searchParams.get("query")).toBe("사주 궁합");
    expect(url.searchParams.get("start_date")).toBe("2026-10-29");
    expect(searchInit.headers).toEqual({ "x-api-key": "sk_test" });

    const profileUrl = new URL((fetchImpl.mock.calls[1] as unknown as [string])[0]);
    expect(profileUrl.pathname).toBe("/v1/threads/user/posts");
    expect(profileUrl.searchParams.get("handle")).toBe("the.saju");
  });

  it("turns a non-2xx answer into an error with the status", async () => {
    const fetchImpl = vi.fn(async () => new Response("Insufficient credits", { status: 402 }));
    const client = createScrapeCreatorsThreadsClient("sk_test", fetchImpl as unknown as typeof fetch);

    await expect(client.search("사주")).rejects.toThrow("scrapecreators /v1/threads/search 402: Insufficient credits");
  });
});
