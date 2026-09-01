import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildTrackedUrl } from "@/lib/tracking-url";
import { parseBrandConfig } from "@/types/brand";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ code: string }> | { code: string } }
) {
  const params = await context.params;
  const code = params.code;

  if (!code) {
    return NextResponse.redirect(process.env.APP_URL || "https://thread-uploader.vercel.app", {
      status: 307,
    });
  }

  try {
    const post = await prisma.post.findUnique({
      where: { id: code },
      include: { brand: true },
    });

    if (!post) {
      return NextResponse.redirect(process.env.APP_URL || "https://thread-uploader.vercel.app", {
        status: 307,
      });
    }

    // Atomically increment clicks without blocking redirect if it fails
    await prisma.post
      .update({
        where: { id: post.id },
        data: { clicks: { increment: 1 } },
      })
      .catch((error) => {
        console.error("Failed to increment click count:", error);
      });

    const brandConfig = parseBrandConfig(post.brand.brandConfig);
    const defaultLanding =
      brandConfig.productProfile?.landingUrl ||
      (brandConfig.websiteUrl ? `${brandConfig.websiteUrl}/start` : null) ||
      process.env.APP_URL ||
      "https://thread-uploader.vercel.app";

    let destinationUrl = post.linkUrl || defaultLanding;

    // Ensure tracking params are preserved
    if (!destinationUrl.includes("pid=") && post.id) {
      destinationUrl = buildTrackedUrl(destinationUrl, {
        postId: post.id,
        formulaId: post.formulaId ?? undefined,
        campaignId: post.campaignId ?? undefined,
      });
    }

    return NextResponse.redirect(destinationUrl, {
      status: 307,
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (error) {
    console.error("Redirect error in /r/[code]:", error);
    return NextResponse.redirect(process.env.APP_URL || "https://thread-uploader.vercel.app", {
      status: 307,
    });
  }
}
