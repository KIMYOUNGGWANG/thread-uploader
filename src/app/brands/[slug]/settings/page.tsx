import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { parseBrandConfig } from "@/types/brand";
import { BrandSettingsForm } from "@/components/BrandSettingsForm";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function BrandSettingsPage({ params }: PageProps) {
  const { slug } = await params;

  const cookieStore = await cookies();
  const session = cookieStore.get("auth_session");
  const userId = session?.value && session.value !== "true" ? session.value : null;
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
        accessToken: brand.accessToken,
        threadsUserId: brand.threadsUserId,
        tokenExpiry: brand.tokenExpiry.toISOString().split("T")[0],
        config,
      }}
    />
  );
}
