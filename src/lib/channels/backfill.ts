import { prisma } from "@/lib/prisma";
import {
  ensureLegacyChannelAccount, mirrorInstagramFromPost, mirrorThreadsFromPost, type ChannelPlatform,
} from "@/lib/channels/publication-mirror";

export type GroupPlan = {
  slug: string;
  name: string;
  ownerId: string;
  markets: { brandId: string; marketLabel: string | null; locale: string | null }[];
};

export type BackfillReport = {
  groupsToCreate: number;
  accountsToCreate: number;
  threadsPosts: number;
  instagramPosts: number;
  applied: boolean;
};

type PlanBrand = { id: string; slug: string; name: string; ownerId: string; groupId: string | null };

const COSMICPATH_MARKETS: Record<string, { marketLabel: string; locale: string }> = {
  cosmicpath: { marketLabel: "국내", locale: "ko" },
  "cosmicpath-global": { marketLabel: "해외", locale: "en" },
};

export function planBrandGrouping(brands: PlanBrand[]): GroupPlan[] {
  const plans: GroupPlan[] = [];
  let cosmicpath: GroupPlan | undefined;
  for (const brand of brands) {
    if (brand.groupId) continue;
    const market = COSMICPATH_MARKETS[brand.slug];
    if (!market) {
      plans.push({
        slug: brand.slug, name: brand.name, ownerId: brand.ownerId,
        markets: [{ brandId: brand.id, marketLabel: null, locale: null }],
      });
      continue;
    }
    if (!cosmicpath) {
      cosmicpath = { slug: "cosmicpath", name: "CosmicPath", ownerId: brand.ownerId, markets: [] };
      plans.push(cosmicpath);
    }
    cosmicpath.markets.push({ brandId: brand.id, ...market });
  }
  // Stable market order regardless of query order: domestic first.
  cosmicpath?.markets.sort((a, b) => (a.locale === "ko" ? -1 : 1) - (b.locale === "ko" ? -1 : 1));
  return plans;
}

export async function runChannelBackfill({ apply }: { apply: boolean }): Promise<BackfillReport> {
  const brands = await prisma.brand.findMany({
    select: {
      id: true, slug: true, name: true, ownerId: true, groupId: true,
      accessToken: true, threadsUserId: true, instagramConnectedAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  const plans = planBrandGrouping(brands);
  if (apply) {
    for (const plan of plans) {
      await prisma.$transaction(async (tx) => {
        const group = await tx.brandGroup.create({
          data: { slug: plan.slug, name: plan.name, ownerId: plan.ownerId },
          select: { id: true },
        });
        for (const market of plan.markets) {
          await tx.brand.update({
            where: { id: market.brandId },
            data: { groupId: group.id, marketLabel: market.marketLabel, locale: market.locale },
          });
        }
      });
    }
  }

  let accountsToCreate = 0;
  for (const brand of brands) {
    const platforms: ChannelPlatform[] = [];
    if (brand.accessToken || brand.threadsUserId) platforms.push("threads");
    if (brand.instagramConnectedAt) platforms.push("instagram");
    for (const platform of platforms) {
      const existing = await prisma.channelAccount.findFirst({
        where: { brandId: brand.id, platform }, select: { id: true },
      });
      if (existing) continue;
      accountsToCreate++;
      if (apply) await ensureLegacyChannelAccount(brand.id, platform);
    }
  }

  const [threadsPosts, instagramPosts] = await Promise.all([
    prisma.post.findMany({ where: { threadsId: { not: null } }, select: { id: true }, orderBy: { createdAt: "asc" } }),
    prisma.post.findMany({ where: { instagramStatus: { not: null } }, select: { id: true }, orderBy: { createdAt: "asc" } }),
  ]);
  if (apply) {
    // Sequential on purpose: each mirror is a few small queries and the route has maxDuration 300.
    for (const { id } of threadsPosts) await mirrorThreadsFromPost(id);
    for (const { id } of instagramPosts) await mirrorInstagramFromPost(id);
  }

  return {
    groupsToCreate: plans.length,
    accountsToCreate,
    threadsPosts: threadsPosts.length,
    instagramPosts: instagramPosts.length,
    applied: apply,
  };
}
