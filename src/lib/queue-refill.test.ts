import { describe, expect, it } from "vitest";
import { parseRefillTarget, planRefillCount } from "@/lib/queue-refill";

describe("queue refill planning", () => {
  it("fills the gap up to the per-run cap", () => {
    expect(planRefillCount(7, 10)).toBe(3);
    expect(planRefillCount(0, 10)).toBe(6);
  });

  it("generates nothing when the backlog already meets the target", () => {
    expect(planRefillCount(10, 10)).toBe(0);
    expect(planRefillCount(14, 10)).toBe(0);
  });

  it("accepts only integer targets between 1 and 50", () => {
    expect(parseRefillTarget("10")).toBe(10);
    expect(parseRefillTarget(null)).toBeNull();
    expect(parseRefillTarget("0")).toBeNull();
    expect(parseRefillTarget("2.5")).toBeNull();
    expect(parseRefillTarget("99")).toBeNull();
  });
});
