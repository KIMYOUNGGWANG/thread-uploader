import { beforeEach, describe, expect, it, vi } from "vitest";

type Where = { status?: unknown };
type PostRow = { id: string; content: string; postCategory: string; formulaId: string | null; createdAt: Date };

const state = vi.hoisted(() => ({
  published: [] as PostRow[],
  candidates: [] as PostRow[],
  normalPick: null as PostRow | null,
}));

const mocks = vi.hoisted(() => ({
  findBrands: vi.fn(),
  publishOrResumePost: vi.fn(async () => ({ success: true, rootThreadsId: "threads_1" })),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    brand: { findMany: mocks.findBrands, update: vi.fn(async () => ({})) },
    post: {
      findFirst: vi.fn(async ({ where }: { where: Where }) => (where.status === "PENDING" ? state.normalPick : null)),
      findMany: vi.fn(async ({ where, take }: { where: Where; take?: number }) => {
        if (where.status === "PUBLISHED") return state.published;
        if (where.status === "PENDING") return take ? state.candidates : [...state.candidates];
        return [];
      }),
      count: vi.fn(async () => 0),
      update: vi.fn(async () => ({})),
    },
  },
}));

vi.mock("@/lib/threads-api", () => ({ getFreshBrandCredentials: vi.fn(async () => ({ accessToken: "token", userId: "user" })) }));
vi.mock("@/lib/threads/thread-resume-engine", () => ({ publishOrResumePost: mocks.publishOrResumePost }));
vi.mock("@/lib/alert-service", () => ({ sendSystemAlert: vi.fn(async () => undefined) }));
vi.mock("@/lib/behavioral-jitter", async () => {
  const actual = await vi.importActual<typeof import("@/lib/behavioral-jitter")>("@/lib/behavioral-jitter");
  return {
    ...actual,
    isCircadianQuietHour: vi.fn(() => false),
    checkMinimumCooldown: vi.fn(() => ({ allowed: true, remainingMinutes: 0, earliestAllowedAt: new Date() })),
  };
});

const START = "2026-01-01T00:00:00.000Z";
const created = new Date("2026-02-01T00:00:00.000Z");
const brandConfig = JSON.stringify({ lengthExperiment: { startAt: START, sequence: "LS", shortMax: 260, longMin: 390 } });

function row(id: string, length: number, overrides: Partial<PostRow> = {}) {
  return {
    id, content: "가".repeat(length), postCategory: "GROWTH", formulaId: "concept_hierarchy", createdAt: created,
    status: "PENDING", qualityPass: true, algorithmicPass: true, firstComment: null, imageUrls: "[]", ...overrides,
  };
}

async function runPublish() {
  const { GET } = await import("@/app/api/cron/publish/route");
  const response = await GET({ headers: new Headers(), nextUrl: new URL("http://localhost/api/cron/publish") } as never);
  return response.json() as Promise<{ published: { postId: string }[]; skipped: { reason: string }[] }>;
}

describe("GET /api/cron/publish under a length experiment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findBrands.mockResolvedValue([{ id: "brand_1", name: "CosmicPath", brandConfig }]);
    state.published = [];
    state.candidates = [];
    state.normalPick = null;
  });

  it("publishes the oldest draft matching the slot arm", async () => {
    state.candidates = [row("new-S", 200), row("new-L", 420)];

    const body = await runPublish();

    expect(body.published.map((item) => item.postId)).toEqual(["new-L"]);
    expect(mocks.publishOrResumePost).toHaveBeenCalledWith("new-L", expect.anything());
  });

  it("skips the slot with length_experiment_waiting_L when no matching draft exists", async () => {
    state.candidates = [row("new-S", 200)];

    const body = await runPublish();

    expect(body.skipped.map((item) => item.reason)).toEqual(["length_experiment_waiting_L"]);
    expect(mocks.publishOrResumePost).not.toHaveBeenCalled();
  });

  it("publishes an approved promo draft without consuming the sequence", async () => {
    state.published = [row("pub-L", 420)];
    state.candidates = [row("promo", 200, { formulaId: "video:promo-1" }), row("new-L", 420)];

    const body = await runPublish();

    expect(body.published.map((item) => item.postId)).toEqual(["promo"]);
  });

  it("considers matching drafts before their scheduled time so a fresh experiment queue is not idle", async () => {
    state.candidates = [row("new-L", 420)];
    const { prisma } = await import("@/lib/prisma");

    await runPublish();

    const candidateQuery = vi.mocked(prisma.post.findMany).mock.calls.map(([args]) => args).find((args) => args?.take);
    expect(candidateQuery?.where).not.toHaveProperty("scheduledAt");
    expect(candidateQuery?.orderBy).toEqual({ scheduledAt: "asc" });
  });

  it("falls back to the normal oldest-first pick after the sequence is used up", async () => {
    state.published = [row("pub-L", 420), row("pub-S", 200)];
    state.candidates = [row("new-S", 200)];
    state.normalPick = row("normal", 300);

    const body = await runPublish();

    expect(body.published.map((item) => item.postId)).toEqual(["normal"]);
  });
});
