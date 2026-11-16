import { describe, it, expect } from "vitest";
import {
  checkCircuitBreaker,
  recordCircuitBreakerFailure,
  recordCircuitBreakerSuccess,
  type CircuitBreakerState,
} from "./threads-publisher";

describe("threads-publisher circuit breaker", () => {
  it("allows publishing when circuit breaker is uninitialized or healthy", () => {
    expect(checkCircuitBreaker({})).toEqual({ isAllowed: true });
    expect(checkCircuitBreaker({ circuitBreaker: { consecutiveFailures: 1, pausedUntil: null } })).toEqual({
      isAllowed: true,
    });
  });

  it("blocks publishing when brand is within pausedUntil window", () => {
    const futureTime = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    const result = checkCircuitBreaker({
      circuitBreaker: {
        consecutiveFailures: 3,
        pausedUntil: futureTime,
        lastFailureReason: "Rate limit exceeded",
      },
    });

    expect(result.isAllowed).toBe(false);
    expect(result.reason).toContain("Circuit breaker active");
  });

  it("automatically unblocks when pausedUntil has expired", () => {
    const pastTime = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const result = checkCircuitBreaker({
      circuitBreaker: {
        consecutiveFailures: 3,
        pausedUntil: pastTime,
        lastFailureReason: "Rate limit exceeded",
      },
    });

    expect(result.isAllowed).toBe(true);
  });

  it("trips circuit breaker on 3rd consecutive failure and sets 1-hour pause", () => {
    const initialConfig: { circuitBreaker?: CircuitBreakerState } = {
      circuitBreaker: { consecutiveFailures: 2, pausedUntil: null },
    };

    const updated = recordCircuitBreakerFailure(initialConfig, "API error 500", 3, 60 * 60 * 1000);
    expect(updated.circuitBreaker!.consecutiveFailures).toBe(3);
    expect(updated.circuitBreaker!.pausedUntil).not.toBeNull();
    expect(new Date(updated.circuitBreaker!.pausedUntil!).getTime()).toBeGreaterThan(Date.now());
  });

  it("resets failure counter on success", () => {
    const failedConfig = {
      circuitBreaker: { consecutiveFailures: 2, pausedUntil: null, lastFailureReason: "Err" },
    };

    const updated = recordCircuitBreakerSuccess(failedConfig);
    expect(updated.circuitBreaker!.consecutiveFailures).toBe(0);
    expect(updated.circuitBreaker!.pausedUntil).toBeNull();
    expect(updated.circuitBreaker!.lastFailureReason).toBeNull();
  });
});
