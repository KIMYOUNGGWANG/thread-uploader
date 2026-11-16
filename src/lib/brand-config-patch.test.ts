import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  updateMany: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: { brand: { findUnique: mocks.findUnique, updateMany: mocks.updateMany } } }));

import { changedBrandConfigKeys, patchBrandConfig } from "@/lib/brand-config-patch";
import { parseBrandConfig } from "@/types/brand";

const STALE = JSON.stringify({ topics: ["old topic"], sporadicEnabled: true });
const written = (call = 0) => (mocks.updateMany.mock.calls[call][0] as { data: { brandConfig: string } }).data.brandConfig;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.updateMany.mockResolvedValue({ count: 1 });
});

describe("changedBrandConfigKeys", () => {
  it("returns only the keys whose value differs from the config as it was read", () => {
    const before = parseBrandConfig(STALE);

    const patch = changedBrandConfigKeys(before, { ...before, lastTickSkipped: true, topics: before.topics });

    expect(patch).toEqual({ lastTickSkipped: true });
  });

  it("keeps an explicitly undefined key so the write removes it", () => {
    const before = parseBrandConfig(JSON.stringify({ lastTickSkipped: true }));

    expect(changedBrandConfigKeys(before, { lastTickSkipped: undefined })).toEqual({ lastTickSkipped: undefined });
  });
});

describe("patchBrandConfig", () => {
  // The publish cron reads every brand once and then publishes for seconds; a settings save or another cron
  // can land in between. Writing the whole config back used to revert that save.
  it("applies this writer's change on top of the config stored now, not the one it read earlier", async () => {
    const fresh = JSON.stringify({ topics: ["topic saved meanwhile"], sporadicEnabled: true });
    mocks.findUnique.mockResolvedValue({ brandConfig: fresh });

    await patchBrandConfig("brand_1", STALE, { ...parseBrandConfig(STALE), lastTickSkipped: true });

    expect(JSON.parse(written())).toMatchObject({ topics: ["topic saved meanwhile"], lastTickSkipped: true });
    expect(mocks.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "brand_1", brandConfig: fresh } }));
  });

  it("retries on the newest stored config when it changed between the read and the write", async () => {
    mocks.findUnique
      .mockResolvedValueOnce({ brandConfig: JSON.stringify({ topics: ["first"] }) })
      .mockResolvedValueOnce({ brandConfig: JSON.stringify({ topics: ["second"] }) });
    mocks.updateMany.mockResolvedValueOnce({ count: 0 }).mockResolvedValueOnce({ count: 1 });

    await patchBrandConfig("brand_1", STALE, { ...parseBrandConfig(STALE), lastTickSkipped: true });

    expect(mocks.updateMany).toHaveBeenCalledTimes(2);
    expect(JSON.parse(written(1))).toMatchObject({ topics: ["second"], lastTickSkipped: true });
  });

  it("fails loudly after three lost races instead of overwriting", async () => {
    mocks.findUnique.mockResolvedValue({ brandConfig: STALE });
    mocks.updateMany.mockResolvedValue({ count: 0 });

    await expect(patchBrandConfig("brand_1", STALE, { ...parseBrandConfig(STALE), lastTickSkipped: true }))
      .rejects.toThrow(/changed concurrently/);
    expect(mocks.updateMany).toHaveBeenCalledTimes(3);
  });

  it("touches nothing when the writer changed nothing", async () => {
    await patchBrandConfig("brand_1", STALE, parseBrandConfig(STALE));

    expect(mocks.findUnique).not.toHaveBeenCalled();
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });

  it("does nothing when the brand no longer exists", async () => {
    mocks.findUnique.mockResolvedValue(null);

    await patchBrandConfig("brand_1", STALE, { ...parseBrandConfig(STALE), lastTickSkipped: true });

    expect(mocks.updateMany).not.toHaveBeenCalled();
  });
});
