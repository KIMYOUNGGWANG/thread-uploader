import { describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    post: {
      findUnique: vi.fn(),
    },
  },
}));

const png = vi.hoisted(() => ({ body: null as Uint8Array | null }));

vi.mock("next/og", () => {
  return {
    ImageResponse: class MockImageResponse {
      constructor(_element: unknown, options: { headers?: HeadersInit } | undefined) {
        return new Response(png.body ? new Uint8Array(png.body) : "fake-image-binary", {
          status: 200,
          headers: options?.headers,
        });
      }
    },
  };
});

import { GET } from "./route";
import { prisma } from "@/lib/prisma";

describe("GET /api/cards/[id]", () => {
  it("returns 404 if post not found", async () => {
    vi.mocked(prisma.post.findUnique).mockResolvedValueOnce(null);

    const req = new NextRequest("http://localhost:3000/api/cards/missing-id");
    const res = await GET(req, { params: Promise.resolve({ id: "missing-id" }) });

    expect(res.status).toBe(404);
  });

  it("returns 200 and image response with Edge caching headers", async () => {
    vi.mocked(prisma.post.findUnique).mockResolvedValueOnce({
      id: "test-id",
      content: "테스트 훅 제목\n서브 설명\nA. 옵션 1\nB. 옵션 2",
      topic: "커리어",
      brand: { name: "CosmicPath", slug: "cosmicpath" },
    } as never);

    const req = new NextRequest("http://localhost:3000/api/cards/test-id?slide=1");
    const res = await GET(req, { params: Promise.resolve({ id: "test-id" }) });

    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toContain("s-maxage=31536000");
    expect(res.headers.get("Cache-Control")).toContain("stale-while-revalidate=86400");
  });

  it("returns a JPEG for ?format=jpg (Instagram carousel slides)", async () => {
    const sharp = (await import("sharp")).default;
    png.body = new Uint8Array(await sharp({ create: { width: 4, height: 4, channels: 3, background: "#000" } }).png().toBuffer());
    vi.mocked(prisma.post.findUnique).mockResolvedValueOnce({
      id: "test-id",
      content: "훅\nA. 하나\nB. 둘",
      topic: null,
      brand: { name: "CosmicPath", slug: "cosmicpath", brandConfig: JSON.stringify({ websiteUrl: "https://www.cosmicpath.app" }) },
    } as never);

    const res = await GET(new NextRequest("http://localhost:3000/api/cards/test-id?slide=0&format=jpg"), { params: Promise.resolve({ id: "test-id" }) });
    png.body = null;

    expect(res.headers.get("Content-Type")).toBe("image/jpeg");
    const bytes = new Uint8Array(await res.arrayBuffer());
    expect([bytes[0], bytes[1]]).toEqual([0xff, 0xd8]);
  });
});
