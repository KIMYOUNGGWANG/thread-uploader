import { describe, expect, it, vi } from "vitest";

// Stateful post row: updateMany only matches when the status filter really matches,
// which is what exposed the cron PROCESSING lock fighting the engine's PUBLISHING lock.
const row = vi.hoisted(() => ({
  current: { id: "post_1", brandId: "brand_1", status: "PENDING", qualityPass: true, content: "오늘 하루 수고했어요.",
    firstComment: null, imageUrls: "[]", threadPartIds: "[]", threadPartsPosted: 0, threadRootId: null, threadsId: null },
}));

function matches(status: unknown, where: unknown): boolean {
  if (typeof where === "string") return status === where;
  if (where && typeof where === "object" && "in" in where) return (where.in as unknown[]).includes(status);
  return true;
}

vi.mock("@/lib/prisma", () => ({
  prisma: {
    brand: { findMany: vi.fn(async () => [{ id: "brand_1", name: "CosmicPath", slug: "cosmicpath" }]), update: vi.fn() },
    post: {
      findMany: vi.fn(async () => []),
      findFirst: vi.fn(async ({ where }: { where: { status?: unknown } }) =>
        matches(row.current.status, where.status) && where.status !== "PUBLISHED" ? { ...row.current } : null),
      findUnique: vi.fn(async () => ({ ...row.current })),
      count: vi.fn(async () => 0),
      update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => Object.assign(row.current, data)),
      updateMany: vi.fn(async ({ where, data }: { where: { status?: unknown }; data: Record<string, unknown> }) => {
        if (!matches(row.current.status, where.status)) return { count: 0 };
        Object.assign(row.current, data);
        return { count: 1 };
      }),
      create: vi.fn(),
    },
  },
}));

vi.mock("@/lib/threads-api", () => ({
  getFreshBrandCredentials: vi.fn(async () => ({ accessToken: "token", userId: "user" })),
  publishThreadChainWithCredentials: vi.fn(async () => ({ rootThreadsId: "root_1", partIds: ["root_1"] })),
}));

vi.mock("@/lib/alert-service", () => ({ sendSystemAlert: vi.fn() }));

describe("cron publish claim", () => {
  it("publishes a PENDING post instead of failing its own lock", async () => {
    const { GET } = await import("@/app/api/cron/publish/route");
    const response = await GET({ headers: new Headers(), nextUrl: new URL("http://localhost/api/cron/publish") } as never);
    const body = await response.json();

    expect(body.published).toEqual([expect.objectContaining({ postId: "post_1", threadsId: "root_1" })]);
    expect(row.current.status).toBe("PUBLISHED");
  });
});
