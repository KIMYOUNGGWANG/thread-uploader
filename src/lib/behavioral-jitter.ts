/**
 * Behavioral Anti-Fingerprinting & Circadian Jitter Engine
 *
 * Prevents Meta anti-bot machine learning systems from detecting deterministic cron heartbeats
 * by enforcing circadian quiet hours (01:00-06:30 KST), minimum inter-post cooldowns, and
 * occasional sporadic skips. (The slot jitter itself is applied where posts are scheduled.)
 */

export interface CircadianOptions {
  quietStartHour?: number; // default 1 (01:00)
  quietStartMinute?: number; // default 0
  quietEndHour?: number; // default 6 (06:30)
  quietEndMinute?: number; // default 30
  timezoneOffsetHours?: number; // default +9 (KST)
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
const DEFAULT_TIMEZONE_OFFSET = 9; // KST
const DEFAULT_MIN_COOLDOWN_MINUTES = 180;

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


const HOUR_MS = 60 * 60 * 1000;

/**
 * Returns the start of the most recent publish slot whose window contains `now`, or null.
 * Lets a late or repeated scheduler run publish once per slot instead of trusting cron timing.
 */
export function findOpenPublishSlot(now: Date, slotHoursUtc: number[], windowHours: number): Date | null {
  let latest: Date | null = null;
  for (const hour of slotHoursUtc) {
    const slotStart = new Date(now);
    slotStart.setUTCHours(hour, 0, 0, 0);
    if (slotStart.getTime() > now.getTime()) slotStart.setUTCDate(slotStart.getUTCDate() - 1);
    const isOpen = now.getTime() - slotStart.getTime() < windowHours * HOUR_MS;
    if (isOpen && (!latest || slotStart > latest)) latest = slotStart;
  }
  return latest;
}

/** Parses "0,3,12" into UTC hours; null when absent or any entry is not an integer 0-23. */
export function parseSlotHours(raw: string | null): number[] | null {
  if (!raw) return null;
  const hours = raw.split(",").map((part) => Number(part.trim()));
  const isValid = hours.every((hour) => Number.isInteger(hour) && hour >= 0 && hour <= 23);
  return isValid && hours.length > 0 ? hours : null;
}
