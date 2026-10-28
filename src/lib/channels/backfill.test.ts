import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => {
  const prisma = {
    brand: { findMany: vi.fn(), update: vi.fn() },
    brandGroup: { upsert: vi.fn(), findMany: vi.fn() },
    channelAccount: { findFirst: vi.fn() },
    post: { findMany: vi.fn() },
    $transaction: vi.fn(),
  };
  prisma.$transaction.mockImplementation(async (fn: (tx: typeof prisma) => unknown) => fn(prisma));
  return { prisma };
});
vi.mock("@/lib/channels/publication-mirror", () => ({
  ensureLegacyChannelAccount: vi.fn().mockResolvedValue("acc_1"),
  mirrorThreadsFromPost: vi.fn().mockResolvedValue(undefined),
  mirrorInstagramFromPost: vi.fn().mockResolvedValue(undefined),
}));

import { prisma } from "@/lib/prisma";
import {
  ensureLegacyChannelAccount, mirrorInstagramFromPost, mirrorThreadsFromPost,
} from "@/lib/channels/publication-mirror";
import { planBrandGrouping, runChannelBackfill } from "./backfill";

const b = (slug: string, over: Partial<{ groupId: string | null }> = {}) => ({
  id: slug, slug, name: slug, ownerId: "u1", groupId: null, ...over,
});
const dbBrand = (slug: string, over: Record<string, unknown> = {}) => ({
  ...b(slug), accessToken: "tok", threadsUserId: "tu", instagramConnectedAt: null, ...over,
});

describe("planBrandGrouping", () => {
  it("groups the two CosmicPath accounts into one brand", () => {
    const plan = planBrandGrouping([b("cosmicpath"), b("cosmicpath-global"), b("catchdex")]);
    expect(plan).toHaveLength(2);
    const group = plan.find((g) => g.slug === "cosmicpath");
    expect(group?.name).toBe("CosmicPath");
    expect(group?.markets).toEqual([
      { brandId: "cosmicpath", marketLabel: "국내", locale: "ko" },
      { brandId: "cosmicpath-global", marketLabel: "해외", locale: "en" },
    ]);
    expect(plan.find((g) => g.slug === "catchdex")?.markets).toEqual([
      { brandId: "catchdex", marketLabel: null, locale: null },
    ]);
  });

  it("is a no-op for brands that already have a group", () => {
    expect(planBrandGrouping([b("cosmicpath", { groupId: "g1" })])).toEqual([]);
  });
});

describe("runChannelBackfill", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.brandGroup.upsert).mockResolvedValue({ id: "g_new" } as never);
    vi.mocked(prisma.brandGroup.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.brand.findMany).mockResolvedValue([
      dbBrand("cosmicpath"), dbBrand("cosmicpath-global", { instagramConnectedAt: new Date() }),
    ] as never);
    vi.mocked(prisma.channelAccount.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.post.findMany)
      .mockResolvedValueOnce([{ id: "p1" }, { id: "p2" }] as never)
      .mockResolvedValueOnce([{ id: "p3" }] as never);
  });

  it("dry-run writes nothing and reports counts", async () => {
    const report = await runChannelBackfill({ apply: false });
    expect(report).toEqual({
      groupsToCreate: 1, accountsToCreate: 3, threadsPosts: 2, instagramPosts: 1, applied: false,
    });
    expect(prisma.brandGroup.upsert).not.toHaveBeenCalled();
    expect(prisma.brand.update).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(ensureLegacyChannelAccount).not.toHaveBeenCalled();
    expect(mirrorThreadsFromPost).not.toHaveBeenCalled();
    expect(mirrorInstagramFromPost).not.toHaveBeenCalled();
  });

  it("apply creates the group, links markets, ensures accounts and mirrors posts in order", async () => {
    const report = await runChannelBackfill({ apply: true });
    expect(report.applied).toBe(true);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.brandGroup.upsert).toHaveBeenCalledWith({
      where: { slug: "cosmicpath" },
      create: { slug: "cosmicpath", name: "CosmicPath", ownerId: "u1" },
      update: {},
      select: { id: true },
    });
    expect(prisma.brand.update).toHaveBeenCalledWith({
      where: { id: "cosmicpath-global" },
      data: { groupId: "g_new", marketLabel: "해외", locale: "en" },
    });
    expect(ensureLegacyChannelAccount).toHaveBeenCalledTimes(3);
    expect(mirrorThreadsFromPost).toHaveBeenCalledTimes(2);
    expect(mirrorInstagramFromPost).toHaveBeenCalledWith("p3");
  });

  it("a second apply creates nothing new", async () => {
    vi.mocked(prisma.brand.findMany).mockResolvedValue([
      dbBrand("cosmicpath", { groupId: "g1" }), dbBrand("cosmicpath-global", { groupId: "g1" }),
    ] as never);
    vi.mocked(prisma.channelAccount.findFirst).mockResolvedValue({ id: "acc" } as never);
    const r = await runChannelBackfill({ apply: true });
    expect(r.groupsToCreate).toBe(0);
    expect(r.accountsToCreate).toBe(0);
    expect(prisma.brandGroup.upsert).not.toHaveBeenCalled();
  });

  it("dry-run does not count a group whose slug already exists", async () => {
    vi.mocked(prisma.brandGroup.findMany).mockResolvedValue([{ slug: "cosmicpath" }] as never);
    const report = await runChannelBackfill({ apply: false });
    expect(report.groupsToCreate).toBe(0);
  });

  it("apply adopts an existing group by slug and links every market to it", async () => {
    vi.mocked(prisma.brandGroup.findMany).mockResolvedValue([{ slug: "cosmicpath" }] as never);
    vi.mocked(prisma.brandGroup.upsert).mockResolvedValue({ id: "g_existing" } as never);
    const report = await runChannelBackfill({ apply: true });
    expect(report.groupsToCreate).toBe(0);
    expect(prisma.brand.update).toHaveBeenCalledWith({
      where: { id: "cosmicpath" }, data: { groupId: "g_existing", marketLabel: "국내", locale: "ko" },
    });
    expect(prisma.brand.update).toHaveBeenCalledWith({
      where: { id: "cosmicpath-global" }, data: { groupId: "g_existing", marketLabel: "해외", locale: "en" },
    });
  });
});
