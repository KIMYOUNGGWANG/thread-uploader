import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { accessErrorResponse, requireDemoAssetJobForCurrentUser } from "@/lib/brand-access";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    // Authorize job owner
    const { job } = await requireDemoAssetJobForCurrentUser(id);

    // Reset job to QUEUED, clearing errors and attempts
    const updatedJob = await prisma.demoAssetJob.update({
      where: { id: job.id },
      data: {
        status: "QUEUED",
        lockedBy: null,
        lockedAt: null,
        heartbeatAt: null,
        attemptCount: 0,
        errorReason: null,
      },
    });

    return NextResponse.json(updatedJob);
  } catch (error) {
    const response = accessErrorResponse(error);
    if (response) return response;
    console.error("Demo asset job regenerate error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to regenerate demo asset job" },
      { status: 500 }
    );
  }
}
