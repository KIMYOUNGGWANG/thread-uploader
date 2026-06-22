import fs from "fs/promises";
import crypto from "crypto";
import path from "path";
import type { DemoAssetStyle, DemoRenderedAssetType } from "../../types/demo-asset";

// ---------------------------------------------------------------------------
// Storage provider for rendered assets
// ---------------------------------------------------------------------------

interface SaveRenderedAssetInput {
  jobId: string;
  type: DemoRenderedAssetType;
  style: DemoAssetStyle;
  filePath: string;
  mimeType: string;
  fileSize: number;
  sha256: string;
  metaData?: string;
}

/**
 * Saves a rendered asset record to the database.
 * The file is already written to disk by the renderer.
 */
export async function saveRenderedAsset(
  prisma: any,
  input: SaveRenderedAssetInput,
): Promise<string> {
  const record = await prisma.demoRenderedAsset.create({
    data: {
      jobId: input.jobId,
      type: input.type,
      style: input.style,
      filePath: input.filePath,
      mimeType: input.mimeType,
      fileSize: input.fileSize,
      sha256: input.sha256,
      metaData: input.metaData || null,
    },
  });

  return record.id;
}

/**
 * Generates a time-limited download token for an asset.
 * Returns a signed token that expires after the given TTL.
 */
export function generateDownloadToken(
  assetId: string,
  ttlSeconds = 3600,
): string {
  const expiresAt = Math.floor(Date.now() / 1000) + ttlSeconds;
  const secret = process.env.DOWNLOAD_TOKEN_SECRET || "dev-secret-change-me";
  const payload = `${assetId}:${expiresAt}`;
  const signature = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex")
    .slice(0, 16);

  return Buffer.from(`${payload}:${signature}`).toString("base64url");
}

/**
 * Verifies a download token and returns the asset ID if valid.
 */
export function verifyDownloadToken(token: string): string | null {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf-8");
    const parts = decoded.split(":");

    if (parts.length !== 3) return null;

    const [assetId, expiresAtStr, signature] = parts;
    const expiresAt = parseInt(expiresAtStr, 10);

    if (isNaN(expiresAt) || Math.floor(Date.now() / 1000) > expiresAt) {
      return null; // Expired
    }

    const secret = process.env.DOWNLOAD_TOKEN_SECRET || "dev-secret-change-me";
    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(`${assetId}:${expiresAtStr}`)
      .digest("hex")
      .slice(0, 16);

    if (signature !== expectedSignature) {
      return null; // Invalid signature
    }

    return assetId;
  } catch {
    return null;
  }
}

/**
 * Reads a rendered asset file from disk and returns its content with metadata.
 */
export async function readRenderedAsset(
  filePath: string,
): Promise<{ content: Buffer; mimeType: string } | null> {
  try {
    await fs.access(filePath);
    const content = await fs.readFile(filePath);
    const extension = path.extname(filePath).toLowerCase();

    const mimeTypes: Record<string, string> = {
      ".mp4": "video/mp4",
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".webp": "image/webp",
      ".webm": "video/webm",
    };

    return {
      content,
      mimeType: mimeTypes[extension] || "application/octet-stream",
    };
  } catch {
    return null;
  }
}
