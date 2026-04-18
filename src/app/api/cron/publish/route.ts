import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { publishPostWithCredentials, publishReplyWithRetryForBrand } from "@/lib/threads-api";

function verifyCronSecret(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return true;
  const authHeader = request.headers.get("authorization");
  if (authHeader === `Bearer ${cronSecret}`) return true;
  return request.nextUrl.searchParams.get("secret") === cronSecret;
}

export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const brands = await prisma.brand.findMany();
  if (brands.length === 0) {
    return NextResponse.json({ published: [], skipped: [], message: "No brands found" });
  }

  const published: { brandId: string; brandName: string; postId: string; threadsId: string }[] = [];
  const skipped: { brandId: string; brandName: string; reason: "no_pending" | "publish_failed" }[] = [];

  for (const brand of brands) {
    try {
      const post = await prisma.post.findFirst({
        where: { brandId: brand.id, status: "PENDING" },
        orderBy: { scheduledAt: "asc" },
      });

      if (!post) {
        skipped.push({ brandId: brand.id, brandName: brand.name, reason: "no_pending" });
        continue;
      }

      const credentials = { accessToken: brand.accessToken, userId: brand.threadsUserId };
      const imageUrls = JSON.parse(post.imageUrls || "[]") as string[];

      try {
        const threadsId = await publishPostWithCredentials(post.content, credentials, imageUrls);

        let replyError: string | null = null;
        if (post.firstComment) {
          try {
            await publishReplyWithRetryForBrand(post.firstComment, threadsId, credentials);
          } catch (err) {
            replyError = err instanceof Error ? err.message : "reply failed";
          }
        }

        await prisma.post.update({
          where: { id: post.id },
          data: {
            status: "PUBLISHED",
            threadsId,
            errorLog: replyError ? `First comment failed: ${replyError}` : null,
          },
        });

        published.push({ brandId: brand.id, brandName: brand.name, postId: post.id, threadsId });
        console.log(`[cron/publish] ✅ ${brand.name}: ${post.id} → ${threadsId}`);
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
