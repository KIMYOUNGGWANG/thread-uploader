import { notFound } from "next/navigation";
import { getSessionUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TikTokStudioClient } from "@/components/tiktok/TikTokStudioClient";
import { parseBrandConfig } from "@/types/brand";
import { getDomainPreset } from "@/lib/domain-registry";
import { resolveTikTokEngine } from "@/lib/tiktok/tiktok-draft-service";
import { resolveProductName } from "@/lib/tiktok/product-script-engine";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function BrandTikTokPage({ params }: PageProps) {
  const { slug } = await params;

  const userId = await getSessionUserId();
  if (!userId) notFound();

  const brand = await prisma.brand.findUnique({ where: { slug } });
  if (!brand || brand.ownerId !== userId) notFound();

  const config = parseBrandConfig(brand.brandConfig);
  const engine = resolveTikTokEngine(brand.slug, config.qualityProfile);
  const isProduct = engine === "product";

  return (
    <TikTokStudioClient
      brandId={brand.id}
      brandName={brand.name}
      brandSlug={brand.slug}
      engine={engine}
      productName={isProduct ? resolveProductName(brand.name, config.productProfile) : ""}
      suggestedTopics={isProduct ? getDomainPreset(config.qualityProfile).defaultTopics : []}
    />
  );
}
