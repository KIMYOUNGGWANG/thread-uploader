import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(async (): Promise<unknown[]> => []),
}));

vi.mock("@/lib/prisma", () => ({ prisma: { post: { findMany: mocks.findMany } } }));
vi.mock("@/lib/brand-access", () => ({
  requireBrandForCurrentUser: vi.fn(async () => ({ id: "b1" })),
  accessErrorResponse: vi.fn(() => null),
}));

describe("GET /api/posts", () => {
  beforeEach(() => mocks.findMany.mockClear());

  it("keeps the instagram bio anchor out of the dashboard list", async () => {
    const { GET } = await import("@/app/api/posts/route");
    const response = await GET({ nextUrl: new URL("http://localhost/api/posts?brandId=b1") } as never);

    expect(response.status).toBe(200);
    const [args] = mocks.findMany.mock.calls[0] as unknown as [{ where: unknown }];
    expect(args.where).toMatchObject({ brandId: "b1", status: { not: "ANCHOR" } });
  });
});
