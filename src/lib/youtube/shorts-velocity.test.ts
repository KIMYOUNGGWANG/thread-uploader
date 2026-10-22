import { describe, it, expect } from "vitest";
import { calculateShortsVelocity } from "./shorts-velocity";

const now = new Date("2026-10-22T12:00:00Z");
const at = (hoursAgo: number, views: number) => ({
  capturedAt: new Date(now.getTime() - hoursAgo * 36e5),
  views,
});

describe("calculateShortsVelocity", () => {
  it("uses views per hour since publish when only one snapshot exists", () => {
    expect(
      calculateShortsVelocity({
        snapshots: [at(0, 40000)],
        publishedAt: new Date(now.getTime() - 4 * 36e5),
        now,
      }),
    ).toEqual({ velocity: 10000, windowHours: 4 });
  });

  it("uses the oldest snapshot inside the 6h window", () => {
    expect(
      calculateShortsVelocity({
        snapshots: [at(8, 100), at(5, 1000), at(0, 7000)],
        publishedAt: new Date(now.getTime() - 20 * 36e5),
        now,
      }),
    ).toEqual({ velocity: 1200, windowHours: 5 });
  });

  it("clamps negative velocity to 0", () => {
    expect(
      calculateShortsVelocity({
        snapshots: [at(2, 5000), at(0, 4000)],
        publishedAt: new Date(now.getTime() - 10 * 36e5),
        now,
      }).velocity,
    ).toBe(0);
  });

  it("floors the multi-snapshot denominator at one hour", () => {
    expect(
      calculateShortsVelocity({
        snapshots: [at(0.1, 500), at(0, 1000)],
        publishedAt: new Date(now.getTime() - 10 * 36e5),
        now,
      }),
    ).toEqual({ velocity: 500, windowHours: 1 });
  });

  it("never divides by less than one hour", () => {
    expect(
      calculateShortsVelocity({
        snapshots: [at(0, 3000)],
        publishedAt: new Date(now.getTime() - 10 * 60e3),
        now,
      }),
    ).toEqual({ velocity: 3000, windowHours: 1 });
  });
});
