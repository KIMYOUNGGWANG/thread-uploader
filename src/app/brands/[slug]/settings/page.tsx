import { notFound } from "next/navigation";
import { getSessionUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseBrandConfig } from "@/types/brand";
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
      }}
    />
  );
}
