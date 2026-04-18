import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function DELETE(request: NextRequest) {
  try {
    const brandId = request.nextUrl.searchParams.get("brandId");
    if (!brandId) {
      return NextResponse.json({ error: "brandId is required" }, { status: 400 });
    }

    const result = await prisma.post.deleteMany({
      where: { status: "PENDING", brandId },
    });

    return NextResponse.json({
      success: true,
      message: `Deleted ${result.count} pending posts`,
      count: result.count,
    });
  } catch (error) {
    console.error("Reset error:", error);
    return NextResponse.json({ error: "Failed to reset posts" }, { status: 500 });
  }
}
