import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { parseBrandConfig } from "@/types/brand";
import { isAdapterEnabled } from "@/lib/viral-service";
import { loadShortsFeed, parseShortsFilters } from "@/lib/youtube/shorts-feed";
import { ShortsFeed } from "@/components/shorts/ShortsFeed";

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function BrandShortsPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const filters = parseShortsFilters(await searchParams);

  const cookieStore = await cookies();
  const session = cookieStore.get("auth_session");
  const userId = session?.value && session.value !== "true" ? session.value : null;
  if (!userId) notFound();

  const brand = await prisma.brand.findUnique({ where: { slug } });
  if (!brand || brand.ownerId !== userId) notFound();

  const config = parseBrandConfig(brand.brandConfig);
  const { items, lastCapturedAt } = await loadShortsFeed({
    brandId: brand.id,
    ...filters,
    minViews: config.viralDiscovery.youtube.minViews,
  });

  return (
    <ShortsFeed
      items={items}
      lastCapturedAt={lastCapturedAt}
      filters={filters}
      brandSlug={brand.slug}
      brandName={brand.name}
      hasApiKey={Boolean(process.env.YOUTUBE_API_KEY)}
      adapterEnabled={isAdapterEnabled(config.viralDiscovery.adapters, "youtube_shorts")}
    />
  );
}
