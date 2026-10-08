import { describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    post: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("next/og", () => {
  return {
    ImageResponse: class MockImageResponse {
      constructor(_element: unknown, options: { headers?: HeadersInit } | undefined) {
        return new Response("fake-image-binary", {
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
});
