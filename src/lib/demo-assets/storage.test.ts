import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { generateDownloadToken, verifyDownloadToken, readRenderedAsset } from "./storage";
import fs from "fs/promises";
import path from "path";

const TEST_DIR = path.join(process.cwd(), ".data/test-storage");

beforeEach(async () => {
  await fs.mkdir(TEST_DIR, { recursive: true });
});

afterEach(async () => {
  try {
    await fs.rm(TEST_DIR, { recursive: true, force: true });
  } catch {
    // Ignore
  }
});

describe("storage", () => {
  describe("generateDownloadToken / verifyDownloadToken", () => {
    it("generates a valid token that can be verified", () => {
      const token = generateDownloadToken("asset-123", 3600);
      expect(token).toBeTruthy();

      const assetId = verifyDownloadToken(token);
      expect(assetId).toBe("asset-123");
    });

    it("rejects an expired token", () => {
      // Generate with negative TTL (already expired)
      const token = generateDownloadToken("asset-expired", -1);

      const assetId = verifyDownloadToken(token);
      expect(assetId).toBeNull();
    });

    it("rejects a tampered token", () => {
      const token = generateDownloadToken("asset-tamper", 3600);
      const tampered = token.slice(0, -3) + "xxx";

      const assetId = verifyDownloadToken(tampered);
      expect(assetId).toBeNull();
    });

    it("rejects garbage input", () => {
      expect(verifyDownloadToken("")).toBeNull();
      expect(verifyDownloadToken("not-a-token")).toBeNull();
      expect(verifyDownloadToken("a:b")).toBeNull();
    });
  });

  describe("readRenderedAsset", () => {
    it("reads an existing file", async () => {
      const testFile = path.join(TEST_DIR, "test.mp4");
      await fs.writeFile(testFile, "fake video content");

      const result = await readRenderedAsset(testFile);
      expect(result).not.toBeNull();
      expect(result!.mimeType).toBe("video/mp4");
      expect(result!.content.toString()).toBe("fake video content");
    });

    it("returns null for missing file", async () => {
      const result = await readRenderedAsset("/nonexistent/file.mp4");
      expect(result).toBeNull();
    });

    it("returns correct MIME type for PNG", async () => {
      const testFile = path.join(TEST_DIR, "test.png");
      await fs.writeFile(testFile, "fake png");

      const result = await readRenderedAsset(testFile);
      expect(result!.mimeType).toBe("image/png");
    });

    it("defaults to octet-stream for unknown extension", async () => {
      const testFile = path.join(TEST_DIR, "test.xyz");
      await fs.writeFile(testFile, "unknown format");

      const result = await readRenderedAsset(testFile);
      expect(result!.mimeType).toBe("application/octet-stream");
    });
  });
});
