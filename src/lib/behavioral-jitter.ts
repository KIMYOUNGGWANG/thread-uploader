/**
 * Behavioral Anti-Fingerprinting & Circadian Jitter Engine
 *
 * Prevents Meta anti-bot machine learning systems from detecting deterministic cron heartbeats
 * by injecting Gaussian jitter, enforcing circadian quiet hours (01:00-06:30 KST), and
 * enforcing minimum inter-post cooldowns (default 180 mins).
 */

export interface JitterOptions {
  meanMinutes?: number;
  stdDevMinutes?: number;
  minMinutes?: number;
  maxMinutes?: number;
  randomFn?: () => number;
}

export interface CircadianOptions {
  quietStartHour?: number; // default 1 (01:00)
  quietStartMinute?: number; // default 0
  quietEndHour?: number; // default 6 (06:30)
  quietEndMinute?: number; // default 30
  wakeTargetHour?: number; // default 7 (07:30)
  wakeTargetMinute?: number; // default 30
  timezoneOffsetHours?: number; // default +9 (KST)
  randomFn?: () => number;
}

export interface CooldownResult {
  allowed: boolean;
  remainingMinutes: number;
  earliestAllowedAt: Date;
}

const DEFAULT_QUIET_START_HOUR = 1;
const DEFAULT_QUIET_START_MINUTE = 0;
const DEFAULT_QUIET_END_HOUR = 6;
const DEFAULT_QUIET_END_MINUTE = 30;
const DEFAULT_WAKE_TARGET_HOUR = 7;
const DEFAULT_WAKE_TARGET_MINUTE = 30;
const DEFAULT_TIMEZONE_OFFSET = 9; // KST
const DEFAULT_MIN_COOLDOWN_MINUTES = 180;

/**
 * Standard Box-Muller transform for Gaussian random variable
 */
export function sampleGaussian(mean: number, stdDev: number, randomFn: () => number = Math.random): number {
  let u1 = randomFn();
  const u2 = randomFn();
  while (u1 <= 1e-7) {
    u1 = randomFn();
  }
  const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  return mean + z0 * stdDev;
}

/**
 * Calculates a jittered publish time with bounded Gaussian noise.
 */
export function calculateJitteredPublishTime(
  targetDate: Date,
  options: JitterOptions = {}
): Date {
  const mean = options.meanMinutes ?? 12;
  const stdDev = options.stdDevMinutes ?? 6;
  const min = options.minMinutes ?? 5;
  const max = options.maxMinutes ?? 25;
  const randomFn = options.randomFn ?? Math.random;

  const sample = sampleGaussian(mean, stdDev, randomFn);
  const clampedMinutes = Math.max(min, Math.min(max, sample));
  const jitterMs = Math.round(clampedMinutes * 60 * 1000);

  return new Date(targetDate.getTime() + jitterMs);
}

/**
 * Converts a Date to fractional hours in the target timezone.
 */
export function getLocalHours(date: Date, timezoneOffsetHours: number = DEFAULT_TIMEZONE_OFFSET): number {
  const utcHours = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;
  let localHours = utcHours + timezoneOffsetHours;
  while (localHours >= 24) localHours -= 24;
  while (localHours < 0) localHours += 24;
  return localHours;
}

/**
 * Checks whether the date falls within the circadian quiet hours (e.g. 01:00 ~ 06:30 KST).
 */
export function isCircadianQuietHour(
  date: Date,
  options: CircadianOptions = {}
): boolean {
  const offset = options.timezoneOffsetHours ?? DEFAULT_TIMEZONE_OFFSET;
  const startHour = options.quietStartHour ?? DEFAULT_QUIET_START_HOUR;
  const startMin = options.quietStartMinute ?? DEFAULT_QUIET_START_MINUTE;
  const endHour = options.quietEndHour ?? DEFAULT_QUIET_END_HOUR;
  const endMin = options.quietEndMinute ?? DEFAULT_QUIET_END_MINUTE;

  const currentLocalHours = getLocalHours(date, offset);
  const quietStart = startHour + startMin / 60;
  const quietEnd = endHour + endMin / 60;

  if (quietStart <= quietEnd) {
    return currentLocalHours >= quietStart && currentLocalHours < quietEnd;
  }
  // If quiet window spans midnight (e.g. 23:00 to 06:00)
  return currentLocalHours >= quietStart || currentLocalHours < quietEnd;
}

/**
 * If targetDate falls into circadian quiet hours, adjusts it forward to morning wake window
 * with organic jitter.
 */
export function adjustForCircadianRhythm(
  date: Date,
  options: CircadianOptions = {}
): Date {
  if (!isCircadianQuietHour(date, options)) {
    return date;
  }

  const offset = options.timezoneOffsetHours ?? DEFAULT_TIMEZONE_OFFSET;
  const wakeTargetHour = options.wakeTargetHour ?? DEFAULT_WAKE_TARGET_HOUR;
  const wakeTargetMinute = options.wakeTargetMinute ?? DEFAULT_WAKE_TARGET_MINUTE;
  const randomFn = options.randomFn ?? Math.random;

  // Compute the start of the local day in UTC
  const localTimeMs = date.getTime() + offset * 3600 * 1000;
  const localDate = new Date(localTimeMs);
  
  // Morning wake base in local time
  localDate.setUTCHours(wakeTargetHour, wakeTargetMinute, 0, 0);

  // Add 0 to 30 mins jitter to wake window
  const wakeJitterMinutes = Math.floor(randomFn() * 30);
  const adjustedLocalMs = localDate.getTime() + wakeJitterMinutes * 60 * 1000;

  // Convert back to UTC Date
  return new Date(adjustedLocalMs - offset * 3600 * 1000);
}

/**
 * Verifies that the minimum inter-post cooldown has elapsed since the last published post.
 */
export function checkMinimumCooldown(
  lastPublishedAt: Date | null,
  nextPublishAt: Date,
  minCooldownMinutes: number = DEFAULT_MIN_COOLDOWN_MINUTES
): CooldownResult {
  if (!lastPublishedAt) {
    return {
      allowed: true,
      remainingMinutes: 0,
      earliestAllowedAt: nextPublishAt,
    };
  }

  const diffMinutes = (nextPublishAt.getTime() - lastPublishedAt.getTime()) / (60 * 1000);
  if (diffMinutes >= minCooldownMinutes) {
    return {
      allowed: true,
      remainingMinutes: 0,
      earliestAllowedAt: nextPublishAt,
    };
  }

  const remainingMinutes = Math.ceil(minCooldownMinutes - diffMinutes);
  const earliestAllowedAt = new Date(lastPublishedAt.getTime() + minCooldownMinutes * 60 * 1000);

  return {
    allowed: false,
    remainingMinutes,
    earliestAllowedAt,
  };
}

export interface SporadicOptions {
  skipProbability?: number; // default 0.18 (~18%)
  randomFn?: () => number;
}

export interface SporadicCheckResult {
  shouldSkip: boolean;
  reason?: "sporadic_skip" | "protected_after_skip" | "probability_passed";
  skipProbability: number;
}

export const DEFAULT_SPORADIC_SKIP_PROBABILITY = 0.18;

/**
 * Anti-Bot Sporadic Cadence Checker
 *
 * Inspired by autoTHREADS sporadic timing engine.
 * Skips ~18% of scheduled ticks to prevent robotic hourly cron heartbeats,
 * but GUARANTEES no back-to-back skips (never skips twice in a row).
 */
export function evaluateSporadicSkip(
  lastTickSkipped: boolean,
  options: SporadicOptions = {}
): SporadicCheckResult {
  const skipProbability = options.skipProbability ?? DEFAULT_SPORADIC_SKIP_PROBABILITY;
  const randomFn = options.randomFn ?? Math.random;

  // Rule 1: Never skip twice in a row
  if (lastTickSkipped) {
    return {
      shouldSkip: false,
      reason: "protected_after_skip",
      skipProbability,
    };
  }

  // Rule 2: Probabilistic skip (~18%)
  const roll = randomFn();
  if (roll < skipProbability) {
    return {
      shouldSkip: true,
      reason: "sporadic_skip",
      skipProbability,
    };
  }

  return {
    shouldSkip: false,
    reason: "probability_passed",
    skipProbability,
  };
}

