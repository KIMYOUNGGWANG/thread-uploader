import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { ForbiddenError, ResourceNotFoundError, requireBrandForCurrentUser } from "@/lib/brand-access";
import { setReferenceDecision } from "@/lib/reference-review";

vi.mock("@/lib/brand-access", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/brand-access")>()),
  requireBrandForCurrentUser: vi.fn(),
}));
vi.mock("@/lib/reference-review", () => ({ setReferenceDecision: vi.fn() }));

import { PATCH } from "./route";

const call = (body: unknown) => PATCH(
  new NextRequest("http://localhost/api/viral/references/e1", { method: "PATCH", body: JSON.stringify(body) }),
  { params: Promise.resolve({ id: "e1" }) },
);

describe("PATCH /api/viral/references/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireBrandForCurrentUser).mockResolvedValue({} as never);
  });

  it("rejects a missing brandId and an unknown decision without touching the db", async () => {
    expect((await call({ decision: "approved" })).status).toBe(400);
    expect((await call({ brandId: "b1", decision: "maybe" })).status).toBe(400);
    expect((await call({ brandId: "b1" })).status).toBe(400);
    expect(setReferenceDecision).not.toHaveBeenCalled();
  });

  it("saves approved, rejected and null (undo)", async () => {
    for (const decision of ["approved", "rejected", null]) {
      const response = await call({ brandId: "b1", decision });
      expect(response.status).toBe(200);
      expect(setReferenceDecision).toHaveBeenLastCalledWith("b1", "e1", decision);
    }
  });

  it("does not write when the user does not own the brand", async () => {
    vi.mocked(requireBrandForCurrentUser).mockRejectedValueOnce(new ForbiddenError());
    expect((await call({ brandId: "b1", decision: "approved" })).status).toBe(403);
    expect(setReferenceDecision).not.toHaveBeenCalled();
  });

  it("answers 404 when the example is not in that brand", async () => {
    vi.mocked(setReferenceDecision).mockRejectedValueOnce(new ResourceNotFoundError("Reference not found"));
    expect((await call({ brandId: "b1", decision: "approved" })).status).toBe(404);
  });
});
