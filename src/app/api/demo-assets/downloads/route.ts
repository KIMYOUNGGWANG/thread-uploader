import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyDownloadToken, readRenderedAsset } from "@/lib/demo-assets/storage";
import path from "path";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.json({ error: "Token is required" }, { status: 400 });
    }

    const assetId = verifyDownloadToken(token);
    if (!assetId) {
      return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 });
    }

    const asset = await prisma.demoRenderedAsset.findUnique({
      where: { id: assetId },
    });

    if (!asset) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }

    const fileData = await readRenderedAsset(asset.filePath);
    if (!fileData) {
      return NextResponse.json({ error: "Asset file not found on disk" }, { status: 404 });
    }

    const filename = path.basename(asset.filePath);
    const headers = new Headers();
    headers.set("Content-Type", fileData.mimeType);
    headers.set("Content-Length", fileData.content.length.toString());
    
    const isDownload = searchParams.get("download") === "true";
    if (isDownload) {
      headers.set("Content-Disposition", `attachment; filename="${filename}"`);
    } else {
      headers.set("Content-Disposition", `inline; filename="${filename}"`);
    }

    return new NextResponse(new Uint8Array(fileData.content), {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error("Demo asset download error:", error);
    return NextResponse.json(
      { error: "Failed to download asset" },
      { status: 500 }
    );
  }
}
