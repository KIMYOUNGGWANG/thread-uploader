import { beforeEach, describe, expect, it, vi } from "vitest";

// ALERT_WEBHOOK_URL is unset in production and the scheduler workflow only goes red on a non-2xx answer
// (curl --fail-with-body), so a publish that failed but answered 200 reached nobody.
const mocks = vi.hoisted(() => ({
  publishOrResumePost: vi.fn(),
  getFreshBrandCredentials: vi.fn(),
  row: { id: "post_1", brandId: "brand_1", status: "PENDING", qualityPass: true as boolean | null, content: "오늘 하루 수고했어요.",
    firstComment: null, imageUrls: "[]", threadPartIds: "[]", threadPartsPosted: 0, threadRootId: null, threadsId: null },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    brand: { findMany: vi.fn(async () => [{ id: "brand_1", name: "CosmicPath", slug: "cosmicpath" }]), update: vi.fn() },
    post: {
      findMany: vi.fn(async () => []),
      findFirst: vi.fn(async ({ where }: { where: { status?: unknown; qualityPass?: unknown } }) =>
        where.status === "PENDING" && (where.qualityPass === undefined || where.qualityPass === mocks.row.qualityPass)
          ? { ...mocks.row }
          : null),
      count: vi.fn(async () => 0),
      update: vi.fn(),
      updateMany: vi.fn(async () => ({ count: 1 })),
    },
  },
}));

vi.mock("@/lib/threads-api", () => ({ getFreshBrandCredentials: mocks.getFreshBrandCredentials }));
vi.mock("@/lib/threads/thread-resume-engine", () => ({ publishOrResumePost: mocks.publishOrResumePost }));
vi.mock("@/lib/alert-service", () => ({ sendSystemAlert: vi.fn() }));

async function callPublish() {
  const { GET } = await import("@/app/api/cron/publish/route");
  const response = await GET({ headers: new Headers(), nextUrl: new URL("http://localhost/api/cron/publish") } as never);
  return { status: response.status, body: await response.json() };
}

describe("cron publish failure signal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.row.qualityPass = true;
    mocks.getFreshBrandCredentials.mockResolvedValue({ accessToken: "token", userId: "user" });
  });

  it("answers 200 when the post is published", async () => {
    mocks.publishOrResumePost.mockResolvedValue({ success: true, rootThreadsId: "root_1", partsPosted: 1, totalParts: 1, isResumed: false });

    const { status, body } = await callPublish();

    expect(status).toBe(200);
    expect(body.published).toEqual([expect.objectContaining({ postId: "post_1", threadsId: "root_1" })]);
  });

  it("answers 200 for a deliberate skip such as a post that was never quality-approved", async () => {
    mocks.row.qualityPass = null;

    const { status, body } = await callPublish();

    expect(status).toBe(200);
    expect(body.published).toEqual([]);
    expect(mocks.publishOrResumePost).not.toHaveBeenCalled();
  });

  it("answers 500 when the publish fails before any part went out", async () => {
    mocks.publishOrResumePost.mockResolvedValue({ success: false, rootThreadsId: null, partsPosted: 0, totalParts: 1, isResumed: false, error: "rate limited" });

    const { status, body } = await callPublish();

    expect(status).toBe(500);
    expect(body.skipped).toEqual([expect.objectContaining({ reason: "publish_failed" })]);
  });

  it("answers 500 when a multi-part thread stops halfway", async () => {
    mocks.publishOrResumePost.mockResolvedValue({ success: false, rootThreadsId: "root_1", partsPosted: 2, totalParts: 4, isResumed: false, error: "part 3 failed" });

    const { status, body } = await callPublish();

    expect(status).toBe(500);
    expect(body.skipped).toEqual([expect.objectContaining({ reason: "partial_failed" })]);
  });

  it("answers 500 when the publish engine throws", async () => {
    mocks.publishOrResumePost.mockRejectedValue(new Error("claimed by another worker"));

    const { status, body } = await callPublish();

    expect(status).toBe(500);
    expect(body.skipped).toEqual([expect.objectContaining({ reason: "publish_failed" })]);
  });

  it("answers 500 when the brand's credentials cannot be loaded (expired token)", async () => {
    mocks.getFreshBrandCredentials.mockRejectedValue(new Error("token expired"));

    const { status, body } = await callPublish();

    expect(status).toBe(500);
    expect(body.skipped).toEqual([expect.objectContaining({ reason: "publish_failed" })]);
    expect(mocks.publishOrResumePost).not.toHaveBeenCalled();
  });
});
