import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { accessErrorResponse, requireDemoAssetJobForCurrentUser } from "@/lib/brand-access";
import { generateDownloadToken } from "@/lib/demo-assets/storage";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    // Authorize job owner
    const { job } = await requireDemoAssetJobForCurrentUser(id);

    const fullJob = await prisma.demoAssetJob.findUnique({
      where: { id: job.id },
      include: {
        captureArtifacts: true,
        renderedAssets: true,
      },
    });

    if (!fullJob) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    const jobWithDownloadUrls = {
      ...fullJob,
      renderedAssets: (fullJob.renderedAssets || []).map((asset) => ({
        ...asset,
        downloadUrl: `/api/demo-assets/downloads?token=${generateDownloadToken(asset.id)}`,
      })),
    };

    return NextResponse.json(jobWithDownloadUrls);
  } catch (error) {
    const response = accessErrorResponse(error);
    if (response) return response;
    console.error("Demo asset job details error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch demo asset job" },
      { status: 500 }
    );
  }
}
