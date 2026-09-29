import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { TikTokStudioClient } from "@/components/tiktok/TikTokStudioClient";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function BrandTikTokPage({ params }: PageProps) {
  const { slug } = await params;

  const cookieStore = await cookies();
  const session = cookieStore.get("auth_session");
  const userId = session?.value && session.value !== "true" ? session.value : null;
  if (!userId) notFound();

  const brand = await prisma.brand.findUnique({ where: { slug } });
  if (!brand || brand.ownerId !== userId) notFound();

  return (
    <TikTokStudioClient
      brandId={brand.id}
      brandName={brand.name}
      brandSlug={brand.slug}
    />
  );
}
