import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { AuthError } from "@/lib/auth";
import { ForbiddenError, ResourceNotFoundError, requireBrandForCurrentUser } from "@/lib/brand-access";
import { listReferencesForReview } from "@/lib/reference-review";

vi.mock("@/lib/brand-access", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/brand-access")>()),
  requireBrandForCurrentUser: vi.fn(),
}));
vi.mock("@/lib/reference-review", () => ({ listReferencesForReview: vi.fn() }));

import { GET } from "./route";

const call = (query = "?brandId=b1") => GET(new NextRequest(`http://localhost/api/viral/references${query}`));

describe("GET /api/viral/references", () => {
  beforeEach(() => vi.clearAllMocks());

  it("needs a brandId", async () => {
    expect((await call("")).status).toBe(400);
    expect(requireBrandForCurrentUser).not.toHaveBeenCalled();
  });

  it("maps auth failures to 401, 403 and 404 before reading any reference", async () => {
    for (const [error, status] of [[new AuthError("Unauthorized"), 401], [new ForbiddenError(), 403], [new ResourceNotFoundError(), 404]] as const) {
      vi.mocked(requireBrandForCurrentUser).mockRejectedValueOnce(error);
      expect((await call()).status).toBe(status);
    }
    expect(listReferencesForReview).not.toHaveBeenCalled();
  });

  it("returns the references for an owned brand", async () => {
    vi.mocked(requireBrandForCurrentUser).mockResolvedValue({} as never);
    vi.mocked(listReferencesForReview).mockResolvedValue([{ id: "e1" }] as never);
    const response = await call();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ references: [{ id: "e1" }] });
    expect(listReferencesForReview).toHaveBeenCalledWith("b1");
  });
});
