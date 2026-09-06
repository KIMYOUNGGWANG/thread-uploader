import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getFreshBrandCredentials,
  publishThreadChainWithCredentials,
} from "@/lib/threads-api";
import { getPublishSafetyBlockReasons } from "@/lib/publish-safety-gate";
import { verifyCronSecret } from "@/lib/cron-auth";

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const brands = await prisma.brand.findMany();
  if (brands.length === 0) {
    return NextResponse.json({ published: [], skipped: [], message: "No brands found" });
  }

  const published: { brandId: string; brandName: string; postId: string; threadsId: string }[] = [];
  const skipped: { brandId: string; brandName: string; reason: "no_pending" | "quality_blocked" | "publish_failed" }[] = [];

  for (const brand of brands) {
    try {
      const now = new Date();
      const post = await prisma.post.findFirst({
        where: {
          brandId: brand.id,
          status: "PENDING",
          scheduledAt: { lte: now },
          OR: [
            { qualityPass: true },
            { qualityPass: null },
          ],
        },
        orderBy: { scheduledAt: "asc" },
      });

      if (!post) {
        const blockedCount = await prisma.post.count({
          where: { brandId: brand.id, status: "PENDING", qualityPass: false },
        });
        skipped.push({
          brandId: brand.id,
          brandName: brand.name,
          reason: blockedCount > 0 ? "quality_blocked" : "no_pending",
        });
        continue;
      }

      const safetyReasons = getPublishSafetyBlockReasons(post);
      if (safetyReasons.length > 0) {
        await prisma.post.update({
          where: { id: post.id },
          data: {
            qualityPass: false,
            qualityReasons: JSON.stringify(safetyReasons),
          },
        });
        skipped.push({ brandId: brand.id, brandName: brand.name, reason: "quality_blocked" });
        continue;
      }

      const credentials = await getFreshBrandCredentials(brand.id);
      const imageUrls = JSON.parse(post.imageUrls || "[]") as string[];

      try {
        const { rootThreadsId: threadsId, replyError, partIds } = await publishThreadChainWithCredentials(
          post.content,
          credentials,
          imageUrls,
          post.firstComment
        );

        await prisma.post.update({
          where: { id: post.id },
          data: {
            status: "PUBLISHED",
            threadsId,
            publishedAt: new Date(),
            errorLog: replyError ? `First comment failed: ${replyError}` : null,
          },
        });

        published.push({ brandId: brand.id, brandName: brand.name, postId: post.id, threadsId });
        console.log(`[cron/publish] ✅ ${brand.name}: ${post.id} → ${threadsId} (${partIds.length} parts)`);
      } catch (publishErr) {
        console.error(`[cron/publish] ❌ ${brand.name}: publish failed`, publishErr);
        await prisma.post.update({
          where: { id: post.id },
          data: {
            status: "FAILED",
            errorLog: publishErr instanceof Error ? publishErr.message : "publish failed",
          },
        }).catch(console.error);
        skipped.push({ brandId: brand.id, brandName: brand.name, reason: "publish_failed" });
      }
    } catch (brandErr) {
      console.error(`[cron/publish] ❌ brand error`, brandErr);
      skipped.push({ brandId: brand.id, brandName: brand.name, reason: "publish_failed" });
    }
  }

  return NextResponse.json({ published, skipped });
}
