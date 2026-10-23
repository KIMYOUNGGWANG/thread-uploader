import { notFound } from "next/navigation";
import { getSessionUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseBrandConfig } from "@/types/brand";
import { instagramBioAnchorWhere, tryBuildInstagramBioLink } from "@/lib/instagram-bio-anchor";
import { BrandSettingsForm } from "@/components/BrandSettingsForm";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function BrandSettingsPage({ params }: PageProps) {
  const { slug } = await params;

  const userId = await getSessionUserId();
  if (!userId) notFound();

  const brand = await prisma.brand.findUnique({ where: { slug } });
  if (!brand || brand.ownerId !== userId) notFound();

  const config = parseBrandConfig(brand.brandConfig);
  const anchorId = config.instagram.bioAnchorPostId;
  const anchorPost = anchorId
    ? await prisma.post.findFirst({
        where: instagramBioAnchorWhere(brand.id, anchorId),
        select: { id: true, clicks: true, conversions: true },
      })
    : null;
  const instagramExpiry = brand.instagramTokenExpiry;

  return (
    <BrandSettingsForm
      brandId={brand.id}
      brandName={brand.name}
      brandSlug={brand.slug}
      initialData={{
        name: brand.name,
        // Never ship the stored token to the browser; the form only sends a new one when typed
        accessToken: "",
        threadsUserId: brand.threadsUserId,
        tokenExpiry: brand.tokenExpiry ? brand.tokenExpiry.toISOString().split("T")[0] : null,
        config,
        instagram: {
          username: brand.instagramUsername,
          tokenExpiry: instagramExpiry ? instagramExpiry.toISOString().split("T")[0] : null,
          needsReconnect: instagramExpiry ? instagramExpiry < new Date() : false,
          bioLink: tryBuildInstagramBioLink(config.websiteUrl, anchorPost?.id),
          clicks: anchorPost?.clicks ?? 0,
          conversions: anchorPost?.conversions ?? 0,
        },
      }}
    />
  );
}
