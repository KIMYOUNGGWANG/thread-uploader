import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => {
  const calls: string[] = [];
  const tx = {
    $executeRaw: vi.fn(async (strings: TemplateStringsArray) => {
      calls.push(strings.join("?"));
      return 1;
    }),
    brand: {
      findUnique: vi.fn(),
      update: vi.fn(async (args: { data: { brandConfig: string } }) => {
        calls.push("update");
        return args;
      }),
    },
  };
  return { calls, tx };
});

vi.mock("@/lib/prisma", () => ({
  prisma: { $transaction: async (run: (tx: typeof db.tx) => Promise<boolean>) => run(db.tx) },
}));

import { acquirePublishLease, PUBLISH_LEASE_MS, readPublishLeaseUntil } from "@/lib/publish-lease";

const now = new Date("2026-11-11T12:00:00.000Z");
const stored = (config: Record<string, unknown>) => db.tx.brand.findUnique.mockResolvedValue({ brandConfig: JSON.stringify(config) });

describe("acquirePublishLease", () => {
  beforeEach(() => {
    db.calls.length = 0;
    db.tx.$executeRaw.mockClear();
    db.tx.brand.update.mockClear();
    db.tx.brand.findUnique.mockReset();
  });

  it("takes the per-brand advisory lock first, then writes a lease that expires after the route's maxDuration", async () => {
    stored({ fidelity: { keep: "me" }, sporadicEnabled: true });

    await expect(acquirePublishLease("brand_1", now)).resolves.toBe(true);

    expect(db.calls[0]).toContain("pg_advisory_xact_lock(hashtext(");
    expect(db.calls[1]).toBe("update");
    const written = JSON.parse(db.tx.brand.update.mock.calls[0][0].data.brandConfig);
    expect(written.publishLeaseUntil).toBe(new Date(now.getTime() + PUBLISH_LEASE_MS).toISOString());
    // Keys BrandConfig does not model survive the write.
    expect(written.fidelity).toEqual({ keep: "me" });
    expect(PUBLISH_LEASE_MS).toBeGreaterThan(300 * 1000);
  });

  it("refuses while another run's lease has not expired, and writes nothing", async () => {
    stored({ publishLeaseUntil: new Date(now.getTime() + 60_000).toISOString() });

    await expect(acquirePublishLease("brand_1", now)).resolves.toBe(false);

    expect(db.tx.brand.update).not.toHaveBeenCalled();
  });

  it("takes over an expired lease, so a run that died mid-publish does not block the brand", async () => {
    stored({ publishLeaseUntil: new Date(now.getTime() - 1).toISOString() });

    await expect(acquirePublishLease("brand_1", now)).resolves.toBe(true);

    expect(db.tx.brand.update).toHaveBeenCalledTimes(1);
  });

  it("refuses for a brand that no longer exists", async () => {
    db.tx.brand.findUnique.mockResolvedValue(null);

    await expect(acquirePublishLease("gone", now)).resolves.toBe(false);
  });

  it("does not overwrite a brandConfig that is not valid JSON", async () => {
    db.tx.brand.findUnique.mockResolvedValue({ brandConfig: "{not json" });

    await expect(acquirePublishLease("brand_1", now)).resolves.toBe(true);

    expect(db.tx.brand.update).not.toHaveBeenCalled();
  });
});

describe("readPublishLeaseUntil", () => {
  it("ignores missing, malformed and non-date values", () => {
    expect(readPublishLeaseUntil(null)).toBeNull();
    expect(readPublishLeaseUntil("{}")).toBeNull();
    expect(readPublishLeaseUntil("not json")).toBeNull();
    expect(readPublishLeaseUntil(JSON.stringify({ publishLeaseUntil: "nope" }))).toBeNull();
    expect(readPublishLeaseUntil(JSON.stringify({ publishLeaseUntil: now.toISOString() }))?.toISOString()).toBe(now.toISOString());
  });
});
