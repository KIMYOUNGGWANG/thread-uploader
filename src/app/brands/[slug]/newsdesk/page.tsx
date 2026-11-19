import { notFound } from "next/navigation";
import { getSessionUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NewsDesk, type RecentItem } from "@/components/newsdesk/NewsDesk";
import { channelStatuses, toItemView } from "@/lib/newsdesk/service";

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ item?: string }>;
}

export default async function BrandNewsDeskPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const { item: itemId } = await searchParams;

  const userId = await getSessionUserId();
  if (!userId) notFound();
  const brand = await prisma.brand.findUnique({ where: { slug } });
  if (!brand || brand.ownerId !== userId) notFound();

  const [recentRows, selected] = await Promise.all([
    prisma.newsItem.findMany({
      where: { brandId: brand.id },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { id: true, sourceTitle: true, sourceText: true, createdAt: true, variants: { select: { platform: true, lockedAt: true } } },
    }),
    itemId ? prisma.newsItem.findFirst({ where: { id: itemId, brandId: brand.id }, include: { variants: true } }) : null,
  ]);
  const recent: RecentItem[] = recentRows.map((row) => ({
    id: row.id,
    title: row.sourceTitle ?? row.sourceText.slice(0, 60),
    createdAt: row.createdAt.toISOString(),
    sent: row.variants.filter((v) => v.lockedAt).map((v) => v.platform),
  }));

  return (
    <NewsDesk
      brand={{ id: brand.id, slug: brand.slug, name: brand.name }}
      recent={recent}
      initialItem={selected ? await toItemView(selected, brand) : null}
      channels={await channelStatuses(brand)}
    />
  );
}
