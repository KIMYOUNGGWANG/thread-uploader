import { describe, expect, it, vi } from "vitest";

const queued = vi.hoisted(() => [] as { scheduledAt: Date }[]);

vi.mock("@anthropic-ai/sdk", () => ({ default: class MockAnthropic {} }));

// Applies the scheduledAt bound and ordering the way Postgres would, so the test sees what the query selects.
vi.mock("@/lib/prisma", () => ({
  prisma: {
    post: {
      findFirst: vi.fn(async ({ where, orderBy }: { where: { scheduledAt?: { lte: Date } }; orderBy: { scheduledAt: "asc" | "desc" } }) => {
        const lte = where.scheduledAt?.lte;
        const rows = queued.filter((post) => !lte || post.scheduledAt <= lte);
        rows.sort((a, b) => (a.scheduledAt.getTime() - b.scheduledAt.getTime()) * (orderBy.scheduledAt === "asc" ? 1 : -1));
        return rows[0] ?? null;
      }),
    },
  },
}));

const HOUR = 60 * 60 * 1000;

describe("resolveQueueBaseTime", () => {
  const now = Date.parse("2026-11-09T12:00:00.000Z");

  it("queues after the near backlog, ignoring drafts booked weeks ahead", async () => {
    const { resolveQueueBaseTime } = await import("@/lib/generate-posts");
    queued.splice(0, queued.length, { scheduledAt: new Date(now + 10 * HOUR) }, { scheduledAt: new Date("2026-11-23T12:00:00.000Z") });

    expect(await resolveQueueBaseTime("b1", false, 3, now)).toBe(now + 14 * HOUR);
  });

  it("starts 4 hours out when only far-future drafts are queued", async () => {
    const { resolveQueueBaseTime } = await import("@/lib/generate-posts");
    queued.splice(0, queued.length, { scheduledAt: new Date("2026-11-23T12:00:00.000Z") });

    expect(await resolveQueueBaseTime("b1", false, 3, now)).toBe(now + 4 * HOUR);
  });
});
