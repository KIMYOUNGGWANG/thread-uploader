import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { Dashboard } from "@/components/Dashboard";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function BrandDashboardPage({ params }: PageProps) {
  const { slug } = await params;

  // session → userId
  const cookieStore = await cookies();
  const session = cookieStore.get("auth_session");
  const userId = session?.value && session.value !== "true" ? session.value : null;
  if (!userId) notFound();

  const brand = await prisma.brand.findUnique({ where: { slug } });
  if (!brand || brand.ownerId !== userId) notFound();

  return <Dashboard brandId={brand.id} brandName={brand.name} brandSlug={brand.slug} />;
}
