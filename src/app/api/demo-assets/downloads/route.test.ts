import { describe, expect, it, vi, beforeEach } from "vitest";

const prismaMocks = vi.hoisted(() => ({
  findUniqueAsset: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    demoRenderedAsset: {
      findUnique: prismaMocks.findUniqueAsset,
    },
  },
}));

const storageMocks = vi.hoisted(() => ({
  verifyDownloadToken: vi.fn(),
  readRenderedAsset: vi.fn(),
}));

import { NextRequest } from "next/server";

vi.mock("@/lib/demo-assets/storage", () => ({
  verifyDownloadToken: storageMocks.verifyDownloadToken,
  readRenderedAsset: storageMocks.readRenderedAsset,
}));

function mockRequest(url: string): NextRequest {
  return new NextRequest(url);
}

describe("Demo Asset Download API Endpoint", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns 400 if token is missing", async () => {
    const { GET } = await import("./route");
    const response = await GET(mockRequest("http://localhost/api/demo-assets/downloads"));
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe("Token is required");
  });

  it("returns 401 if token is invalid or expired", async () => {
    storageMocks.verifyDownloadToken.mockReturnValue(null);
    const { GET } = await import("./route");
    const response = await GET(mockRequest("http://localhost/api/demo-assets/downloads?token=invalid"));
    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error).toBe("Invalid or expired token");
  });

  it("returns 404 if asset not found in database", async () => {
    storageMocks.verifyDownloadToken.mockReturnValue("asset_123");
    prismaMocks.findUniqueAsset.mockResolvedValue(null);
    const { GET } = await import("./route");
    const response = await GET(mockRequest("http://localhost/api/demo-assets/downloads?token=valid_token"));
    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toBe("Asset not found");
  });

  it("returns 404 if file not found on disk", async () => {
    storageMocks.verifyDownloadToken.mockReturnValue("asset_123");
    prismaMocks.findUniqueAsset.mockResolvedValue({
      id: "asset_123",
      filePath: "/path/to/missing.mp4",
      mimeType: "video/mp4",
    });
    storageMocks.readRenderedAsset.mockResolvedValue(null);
    
    const { GET } = await import("./route");
    const response = await GET(mockRequest("http://localhost/api/demo-assets/downloads?token=valid_token"));
    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toBe("Asset file not found on disk");
  });

  it("serves the asset file content with correct headers", async () => {
    storageMocks.verifyDownloadToken.mockReturnValue("asset_123");
    prismaMocks.findUniqueAsset.mockResolvedValue({
      id: "asset_123",
      filePath: "/path/to/exists.mp4",
      mimeType: "video/mp4",
    });
    storageMocks.readRenderedAsset.mockResolvedValue({
      content: Buffer.from("mock-video-content"),
      mimeType: "video/mp4",
    });

    const { GET } = await import("./route");
    const response = await GET(mockRequest("http://localhost/api/demo-assets/downloads?token=valid_token"));
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("video/mp4");
    expect(response.headers.get("Content-Disposition")).toBe("inline; filename=\"exists.mp4\"");
    const text = await response.text();
    expect(text).toBe("mock-video-content");
  });

  it("sets Content-Disposition to attachment when download=true is passed", async () => {
    storageMocks.verifyDownloadToken.mockReturnValue("asset_123");
    prismaMocks.findUniqueAsset.mockResolvedValue({
      id: "asset_123",
      filePath: "/path/to/exists.mp4",
      mimeType: "video/mp4",
    });
    storageMocks.readRenderedAsset.mockResolvedValue({
      content: Buffer.from("mock-video-content"),
      mimeType: "video/mp4",
    });

    const { GET } = await import("./route");
    const response = await GET(mockRequest("http://localhost/api/demo-assets/downloads?token=valid_token&download=true"));
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Disposition")).toBe("attachment; filename=\"exists.mp4\"");
  });
});
