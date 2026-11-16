// Publish circuit breaker. The Threads publish calls themselves live in threads-api.ts.
export interface CircuitBreakerState {
  consecutiveFailures: number;
  pausedUntil: string | null;
  lastFailureReason?: string | null;
}

export function checkCircuitBreaker(
  config: { circuitBreaker?: CircuitBreakerState },
  now: Date = new Date()
): { isAllowed: boolean; reason?: string } {
  const breaker = config.circuitBreaker;
  if (!breaker || !breaker.pausedUntil) {
    return { isAllowed: true };
  }

  const pauseExpiresAt = new Date(breaker.pausedUntil);
  if (pauseExpiresAt.getTime() > now.getTime()) {
    return {
      isAllowed: false,
      reason: `Circuit breaker active until ${breaker.pausedUntil}. Last reason: ${breaker.lastFailureReason || "Unknown"}`,
    };
  }

  return { isAllowed: true };
}

export function recordCircuitBreakerFailure<T extends { circuitBreaker?: CircuitBreakerState }>(
  config: T,
  reason: string,
  threshold: number = 3,
  pauseDurationMs: number = 60 * 60 * 1000,
  now: Date = new Date()
): T {
  const currentFailures = (config.circuitBreaker?.consecutiveFailures || 0) + 1;
  const shouldPause = currentFailures >= threshold;
  const pausedUntil = shouldPause ? new Date(now.getTime() + pauseDurationMs).toISOString() : null;

  return {
    ...config,
    circuitBreaker: {
      consecutiveFailures: currentFailures,
      pausedUntil,
      lastFailureReason: reason,
    },
  } as T;
}

export function recordCircuitBreakerSuccess<T extends { circuitBreaker?: CircuitBreakerState }>(config: T): T {
  return {
    ...config,
    circuitBreaker: {
      consecutiveFailures: 0,
      pausedUntil: null,
      lastFailureReason: null,
    },
  } as T;
}
