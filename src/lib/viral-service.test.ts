import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { getViralReport, learnViralPatterns } from "@/lib/viral-service";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    viralExample: { findMany: vi.fn(async () => []), count: vi.fn(async () => 0) },
    viralPattern: { findMany: vi.fn(async () => []), deleteMany: vi.fn(), create: vi.fn() },
    brand: { findUnique: vi.fn(async () => ({ id: "b1", viralMemory: "{}", brandConfig: "{}" })), update: vi.fn() },
    $transaction: vi.fn(async (ops: unknown[]) => ops),
  },
}));

const EXCLUDE_SHORTS = expect.objectContaining({ source: { not: "youtube_shorts" } });

describe("viral-service shorts exclusion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("getViralReport excludes shorts from examples and sample count", async () => {
    await getViralReport("b1");

    expect(prisma.viralExample.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: EXCLUDE_SHORTS }),
    );
    expect(prisma.viralExample.count).toHaveBeenCalledWith({
      where: expect.objectContaining({ brandId: "b1", source: { not: "youtube_shorts" } }),
    });
  });

  it("learnViralPatterns excludes shorts from pattern learning input", async () => {
    await learnViralPatterns("b1");

    expect(prisma.viralExample.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: EXCLUDE_SHORTS }),
    );
  });
});
