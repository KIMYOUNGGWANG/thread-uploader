import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { accessErrorResponse, requireBrandForCurrentUser } from "@/lib/brand-access";
import { normalizeDemoAssetJobConfig } from "@/types/demo-asset";
import { isPrivateHost, normalizeDemoAssetRequest, shouldBypassLocalhost } from "@/lib/demo-assets/url-intake";
import { generateDownloadToken } from "@/lib/demo-assets/storage";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const config = normalizeDemoAssetJobConfig(body);

    if (!config.brandId) {
      return NextResponse.json({ error: "brandId is required" }, { status: 400 });
    }
    if (!config.productUrl) {
      return NextResponse.json({ error: "productUrl is required" }, { status: 400 });
    }

    // 1. Authorize brand owner
    const { brand } = await requireBrandForCurrentUser(config.brandId);

    // 2. Validate URL safety (SSRF checks)
    let normalizedUrl: string;
    try {
      normalizedUrl = normalizeDemoAssetRequest(config.productUrl);
    } catch (err) {
      return NextResponse.json({ error: "Invalid product URL" }, { status: 400 });
    }

    if (!shouldBypassLocalhost()) {
      const parsed = new URL(normalizedUrl);
      const isPrivate = await isPrivateHost(parsed.hostname);
      if (isPrivate) {
        return NextResponse.json({ error: "Private or local URLs are forbidden" }, { status: 400 });
      }
    }

    // 3. Create DemoAssetJob in db
    const job = await prisma.demoAssetJob.create({
      data: {
        brandId: brand.id,
        productUrl: normalizedUrl,
        productContext: config.productContext || null,
        style: config.style,
        videoCount: config.videoCount,
        imageCount: config.imageCount,
        status: "QUEUED",
      },
    });

    return NextResponse.json(job, { status: 202 });
  } catch (error) {
    const response = accessErrorResponse(error);
    if (response) return response;
    console.error("Demo asset job creation error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create demo asset job" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const brandId = searchParams.get("brandId");

    if (!brandId) {
      return NextResponse.json({ error: "brandId is required" }, { status: 400 });
    }

    // Authorize brand owner
    await requireBrandForCurrentUser(brandId);

    const jobs = await prisma.demoAssetJob.findMany({
      where: { brandId },
      include: {
        captureArtifacts: true,
        renderedAssets: true,
      },
      orderBy: { createdAt: "desc" },
    });

    const jobsWithDownloadUrls = jobs.map((job) => ({
      ...job,
      renderedAssets: (job.renderedAssets || []).map((asset) => ({
        ...asset,
        downloadUrl: `/api/demo-assets/downloads?token=${generateDownloadToken(asset.id)}`,
      })),
    }));

    return NextResponse.json(jobsWithDownloadUrls);
  } catch (error) {
    const response = accessErrorResponse(error);
    if (response) return response;
    console.error("Demo asset jobs list error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to list demo asset jobs" },
      { status: 500 }
    );
  }
}
