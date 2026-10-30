import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const draft = { id: "d1", status: "COMPLETED", brand: { ownerId: "u1" } };

vi.mock("@/lib/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth")>();
  return { ...actual, requireAuth: vi.fn(async () => ({ id: "u1", email: "o@example.com", name: null })) };
});
vi.mock("@/lib/prisma", () => ({
  prisma: { videoDraft: { findUnique: vi.fn(async () => draft), update: vi.fn(async () => draft) } },
}));

import { prisma } from "@/lib/prisma";
import { PATCH } from "./route";

function patch(body: unknown) {
  return PATCH(
    new NextRequest("http://localhost/api/video-drafts/d1/verdict", { method: "PATCH", body: JSON.stringify(body) }),
    { params: Promise.resolve({ id: "d1" }) },
  );
}

describe("PATCH /api/video-drafts/[id]/verdict", () => {
  beforeEach(() => {
    vi.mocked(prisma.videoDraft.update).mockClear();
    draft.status = "COMPLETED";
    draft.brand.ownerId = "u1";
  });

  it("rejects other owners", async () => {
    draft.brand.ownerId = "someone-else";
    const res = await patch({ verdict: "good" });
    expect(res.status).toBe(404);
    expect(prisma.videoDraft.update).not.toHaveBeenCalled();
  });

  it("rejects missing drafts", async () => {
    vi.mocked(prisma.videoDraft.findUnique).mockResolvedValueOnce(null);
    const res = await patch({ verdict: "good" });
    expect(res.status).toBe(404);
  });

  it("rejects non-COMPLETED", async () => {
    draft.status = "RENDERING";
    const res = await patch({ verdict: "good" });
    expect(res.status).toBe(409);
    expect(prisma.videoDraft.update).not.toHaveBeenCalled();
  });

  it("rejects unknown verdict", async () => {
    const res = await patch({ verdict: "meh" });
    expect(res.status).toBe(400);
    expect(prisma.videoDraft.update).not.toHaveBeenCalled();
  });

  it("stores verdict and verdictAt", async () => {
    const res = await patch({ verdict: "bad" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    const { where, data } = vi.mocked(prisma.videoDraft.update).mock.calls[0][0];
    expect(where).toEqual({ id: "d1" });
    expect(data.userVerdict).toBe("bad");
    expect(data.verdictAt).toBeInstanceOf(Date);
  });
});
