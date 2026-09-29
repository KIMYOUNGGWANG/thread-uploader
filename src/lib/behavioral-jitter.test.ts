import { describe, expect, it } from "vitest";
import {
  calculateJitteredPublishTime,
  isCircadianQuietHour,
  adjustForCircadianRhythm,
  checkMinimumCooldown,
  evaluateSporadicSkip,
} from "./behavioral-jitter";

describe("behavioral-jitter", () => {
  it("calculates jitter within specified bounds", () => {
    const base = new Date("2026-09-09T10:00:00Z");
    const jittered = calculateJitteredPublishTime(base, {
      minMinutes: 5,
      maxMinutes: 20,
      meanMinutes: 10,
      stdDevMinutes: 2,
    });

    const diffMinutes = (jittered.getTime() - base.getTime()) / (60 * 1000);
    expect(diffMinutes).toBeGreaterThanOrEqual(5);
    expect(diffMinutes).toBeLessThanOrEqual(20);
  });

  it("identifies circadian quiet hours in KST (UTC+9)", () => {
    // 03:00 KST is 18:00 UTC previous day (3 AM in KST)
    const quietTime = new Date("2026-09-08T18:00:00Z");
    expect(isCircadianQuietHour(quietTime)).toBe(true);

    // 14:00 KST is 05:00 UTC (2 PM in KST)
    const activeTime = new Date("2026-09-09T05:00:00Z");
    expect(isCircadianQuietHour(activeTime)).toBe(false);
  });

  it("adjusts quiet hours forward to morning wake window", () => {
    // 03:30 KST (18:30 UTC previous day)
    const quietTime = new Date("2026-09-08T18:30:00Z");
    const adjusted = adjustForCircadianRhythm(quietTime, {
      wakeTargetHour: 7,
      wakeTargetMinute: 30,
      timezoneOffsetHours: 9,
      randomFn: () => 0.5, // 15 mins jitter
    });

    // 07:30 + 15m = 07:45 KST -> 22:45 UTC previous day
    expect(adjusted.getUTCHours()).toBe(22);
    expect(adjusted.getUTCMinutes()).toBe(45);
    expect(isCircadianQuietHour(adjusted)).toBe(false);
  });

  it("leaves active hours unadjusted", () => {
    // 14:00 KST is 05:00 UTC
    const activeTime = new Date("2026-09-09T05:00:00Z");
    const adjusted = adjustForCircadianRhythm(activeTime);
    expect(adjusted.getTime()).toBe(activeTime.getTime());
  });

  it("enforces minimum cooldown between consecutive posts", () => {
    const lastPublished = new Date("2026-09-09T10:00:00Z");
    
    // Attempting to publish 60 minutes later (violates 180 min cooldown)
    const tooSoon = new Date("2026-09-09T11:00:00Z");
    const checkBlocked = checkMinimumCooldown(lastPublished, tooSoon, 180);
    expect(checkBlocked.allowed).toBe(false);
    expect(checkBlocked.remainingMinutes).toBe(120);
    expect(checkBlocked.earliestAllowedAt.toISOString()).toBe("2026-09-09T13:00:00.000Z");

    // Attempting to publish 200 minutes later (satisfies 180 min cooldown)
    const allowedTime = new Date("2026-09-09T13:20:00Z");
    const checkAllowed = checkMinimumCooldown(lastPublished, allowedTime, 180);
    expect(checkAllowed.allowed).toBe(true);
    expect(checkAllowed.remainingMinutes).toBe(0);
  });

  it("evaluates sporadic skip with ~18% probability and protects after skip", () => {
    // 1. Should skip when random roll is below threshold
    const skipResult = evaluateSporadicSkip(false, {
      skipProbability: 0.18,
      randomFn: () => 0.10,
    });
    expect(skipResult.shouldSkip).toBe(true);
    expect(skipResult.reason).toBe("sporadic_skip");

    // 2. Should NOT skip when random roll is above threshold
    const passResult = evaluateSporadicSkip(false, {
      skipProbability: 0.18,
      randomFn: () => 0.25,
    });
    expect(passResult.shouldSkip).toBe(false);
    expect(passResult.reason).toBe("probability_passed");

    // 3. GUARANTEE: Never skip twice in a row (protected after skip)
    const protectedResult = evaluateSporadicSkip(true, {
      skipProbability: 0.18,
      randomFn: () => 0.01, // roll would normally skip, but protected
    });
    expect(protectedResult.shouldSkip).toBe(false);
    expect(protectedResult.reason).toBe("protected_after_skip");
  });
});

