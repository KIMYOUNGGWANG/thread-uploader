process.loadEnvFile(".env");

import { prisma } from "../src/lib/prisma";
import {
  fetchPublicProfilePosts,
  fetchPublicProfileStats,
  getFreshBrandCredentials,
  searchThreadsByKeyword,
} from "../src/lib/threads-api";
import { normalizeHandle } from "../src/lib/reference-radar";
import { parseBrandConfig } from "../src/types/brand";

// Read-only gate: confirms the production token may call the Threads discovery endpoints.
async function check(label: string, run: () => Promise<string>): Promise<boolean> {
  try {
    console.log(`${label}: ${await run()}`);
    return true;
  } catch (error) {
    console.log(`${label}: error: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

async function main(): Promise<boolean> {
  const brand = await prisma.brand.findUnique({ where: { slug: "cosmicpath" }, select: { id: true, brandConfig: true } });
  if (!brand) throw new Error("Brand cosmicpath not found");

  const { accessToken } = await getFreshBrandCredentials(brand.id);
  const ownHandle = parseBrandConfig(brand.brandConfig).viralDiscovery.ownHandle;

  const results = [
    await check("profile_lookup", async () => {
      await fetchPublicProfileStats(accessToken, "the.saju");
      return "ok";
    }),
    await check("profile_posts", async () => `ok (${(await fetchPublicProfilePosts(accessToken, "the.saju", 3)).length}건)`),
    await check("keyword_search", async () => {
      // Without threads_keyword_search the endpoint still answers 200, but only with the token owner's own posts.
      // A result count alone passed that as "ok" on 2026-10-27; count outside authors instead.
      const posts = await searchThreadsByKeyword(accessToken, "사주", 10);
      const outside = ownHandle
        ? posts.filter((post) => post.username && normalizeHandle(post.username) !== normalizeHandle(ownHandle))
        : posts;
      if (posts.length > 0 && outside.length === 0) {
        throw new Error(`${posts.length}건 전부 본인(@${ownHandle}) 글 — threads_keyword_search 권한 승인 필요`);
      }
      return `ok (${posts.length}건, 남의 글 ${outside.length}건${ownHandle ? "" : ", ownHandle 미설정이라 구분 못 함"})`;
    }),
  ];
  return results.every(Boolean);
}

main()
  .then((ok) => ({ code: ok ? 0 : 1 }))
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    return { code: 1 };
  })
  .then(async ({ code }) => {
    await prisma.$disconnect();
    process.exit(code);
  });
