import { describe, expect, it } from "vitest";
import { consecutiveGood } from "./verdict";

const at = (minutesAgo: number) => new Date(Date.UTC(2026, 9, 30) - minutesAgo * 60_000);
const done = (userVerdict: string | null, minutesAgo: number) => ({ status: "COMPLETED", userVerdict, createdAt: at(minutesAgo) });

describe("consecutiveGood", () => {
  it("counts good verdicts from the newest until the first non-good", () => {
    expect(consecutiveGood([done("good", 0), done("good", 1), done("bad", 2), done("good", 3)])).toBe(2);
  });

  it("sorts by createdAt instead of trusting input order", () => {
    expect(consecutiveGood([done("bad", 2), done("good", 0), done("good", 1)])).toBe(2);
  });

  it("skips RENDERING and FAILED drafts", () => {
    expect(
      consecutiveGood([
        { status: "RENDERING", userVerdict: null, createdAt: at(0) },
        done("good", 1),
        { status: "FAILED", userVerdict: null, createdAt: at(2) },
        done("good", 3),
        done(null, 4),
      ]),
    ).toBe(2);
  });

  it("stops at a completed draft without a verdict", () => {
    expect(consecutiveGood([done(null, 0), done("good", 1)])).toBe(0);
  });

  it("returns 0 for no drafts", () => {
    expect(consecutiveGood([])).toBe(0);
  });
});
