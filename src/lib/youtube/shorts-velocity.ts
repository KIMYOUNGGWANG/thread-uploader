const HOUR_MS = 60 * 60 * 1000;
const WINDOW_MS = 6 * HOUR_MS;

type Snapshot = { capturedAt: Date; views: number };

type VelocityInput = {
  snapshots: Snapshot[];
  publishedAt: Date;
  now: Date;
};

type VelocityResult = { velocity: number; windowHours: number };

const clampRound = (value: number): number => Math.max(0, Math.round(value));
const roundTenth = (value: number): number => Math.round(value * 10) / 10;

function betweenSnapshots(oldest: Snapshot, newest: Snapshot): VelocityResult {
  const hours = (newest.capturedAt.getTime() - oldest.capturedAt.getTime()) / HOUR_MS;
  const windowHours = Math.max(1, hours);
  const velocity = clampRound((newest.views - oldest.views) / windowHours);
  return { velocity, windowHours: roundTenth(windowHours) };
}

function sincePublish(newest: Snapshot | undefined, input: VelocityInput): VelocityResult {
  const hours = (input.now.getTime() - input.publishedAt.getTime()) / HOUR_MS;
  const denominator = Math.max(1, hours);
  return {
    velocity: clampRound((newest?.views ?? 0) / denominator),
    windowHours: roundTenth(denominator),
  };
}

export function calculateShortsVelocity(input: VelocityInput): VelocityResult {
  const sorted = [...input.snapshots].sort((a, b) => a.capturedAt.getTime() - b.capturedAt.getTime());
  const windowStart = input.now.getTime() - WINDOW_MS;
  const inWindow = sorted.filter((s) => s.capturedAt.getTime() >= windowStart);
  if (inWindow.length >= 2) {
    return betweenSnapshots(inWindow[0], inWindow[inWindow.length - 1]);
  }
  return sincePublish(sorted[sorted.length - 1], input);
}
