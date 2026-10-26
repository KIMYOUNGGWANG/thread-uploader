import { beforeEach, describe, expect, it, vi } from "vitest";

type FindFirstArgs = { where: { scheduledAt?: { lte: Date } }; orderBy: { scheduledAt: "asc" | "desc" } };

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(async (): Promise<unknown[]> => []),
  queued: [] as { scheduledAt: Date }[],
  create: vi.fn(async ({ data }: { data: { scheduledAt: Date } }) => ({ id: "p1", status: "PENDING", ...data })),
}));

// Applies the scheduledAt bound and ordering the way Postgres would, so the test sees what the query selects.
function findFirst({ where, orderBy }: FindFirstArgs) {
  const lte = where.scheduledAt?.lte;
  const rows = mocks.queued.filter((post) => !lte || post.scheduledAt <= lte);
  rows.sort((a, b) => (a.scheduledAt.getTime() - b.scheduledAt.getTime()) * (orderBy.scheduledAt === "asc" ? 1 : -1));
  return Promise.resolve(rows[0] ?? null);
}

vi.mock("@/lib/prisma", () => ({ prisma: { post: { findMany: mocks.findMany, findFirst, create: mocks.create } } }));
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

describe("POST /api/posts", () => {
  it("schedules unscheduled posts after the near queue, not after drafts booked weeks ahead", async () => {
    const now = new Date("2026-11-09T12:00:00.000Z");
    vi.useFakeTimers({ now, toFake: ["Date"] });
    try {
      mocks.queued = [{ scheduledAt: new Date("2026-11-23T12:00:00.000Z") }];
      const { POST } = await import("@/app/api/posts/route");
      const request = { json: async () => ({ brandId: "b1", posts: [{ content: "오늘 저녁 하늘 진짜 예뻤음", images: [] }] }) };

      const response = await POST(request as never);

      expect(response.status).toBe(200);
      const [{ data }] = mocks.create.mock.calls.at(-1) as unknown as [{ data: { scheduledAt: Date } }];
      const hoursAhead = (data.scheduledAt.getTime() - now.getTime()) / 3_600_000;
      expect(hoursAhead).toBeGreaterThan(3.7); // 4h interval with up to ±15 min jitter
      expect(hoursAhead).toBeLessThan(4.3);
    } finally {
      vi.useRealTimers();
    }
  });
});
