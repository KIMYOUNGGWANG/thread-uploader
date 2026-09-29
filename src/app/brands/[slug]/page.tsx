import { notFound } from "next/navigation";
import { getSessionUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Dashboard } from "@/components/Dashboard";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function BrandDashboardPage({ params }: PageProps) {
  const { slug } = await params;

  const userId = await getSessionUserId();
  if (!userId) notFound();

  const brand = await prisma.brand.findUnique({ where: { slug } });
  if (!brand || brand.ownerId !== userId) notFound();

  return <Dashboard brandId={brand.id} brandName={brand.name} brandSlug={brand.slug} />;
}
