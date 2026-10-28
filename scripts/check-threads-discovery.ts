process.loadEnvFile(".env");

import { prisma } from "../src/lib/prisma";
import {
  fetchPublicProfilePosts,
  fetchPublicProfileStats,
  getFreshBrandCredentials,
  searchThreadsByKeyword,
} from "../src/lib/threads-api";

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
  const brand = await prisma.brand.findUnique({ where: { slug: "cosmicpath" }, select: { id: true } });
  if (!brand) throw new Error("Brand cosmicpath not found");

  const { accessToken } = await getFreshBrandCredentials(brand.id);

  const results = [
    await check("profile_lookup", async () => {
      await fetchPublicProfileStats(accessToken, "the.saju");
      return "ok";
    }),
    await check("profile_posts", async () => `ok (${(await fetchPublicProfilePosts(accessToken, "the.saju", 3)).length}건)`),
    await check("keyword_search", async () => `ok (${(await searchThreadsByKeyword(accessToken, "사주", 3)).length}건)`),
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
