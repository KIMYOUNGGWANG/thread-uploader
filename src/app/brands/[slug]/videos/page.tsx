import { notFound } from "next/navigation";
import { getSessionUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { VideoFactoryPanel } from "@/components/videos/VideoFactoryPanel";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function BrandVideosPage({ params }: PageProps) {
  const { slug } = await params;

  const userId = await getSessionUserId();
  if (!userId) notFound();

  const brand = await prisma.brand.findUnique({ where: { slug } });
  if (!brand || brand.ownerId !== userId) notFound();

  const [drafts, history] = await Promise.all([
    prisma.videoDraft.findMany({
      where: { brandId: brand.id },
      orderBy: { createdAt: "desc" },
      take: 7,
      select: {
        id: true, status: true, kstDate: true, script: true, renderErrors: true, videoUrl: true,
        coverUrl: true, userVerdict: true, createdAt: true, clipAsset: { select: { license: true } },
      },
    }),
    // ponytail: last 30 completed is enough for a 5-in-a-row goal; streaks above 30 show as 30
    prisma.videoDraft.findMany({
      where: { brandId: brand.id, status: "COMPLETED" },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: { id: true, status: true, userVerdict: true, createdAt: true },
    }),
  ]);

  return <VideoFactoryPanel drafts={drafts} history={history} brandSlug={brand.slug} brandName={brand.name} />;
}
