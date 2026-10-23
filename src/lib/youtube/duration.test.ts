import { describe, it, expect } from "vitest";
import { parseIsoDuration } from "./duration";

describe("parseIsoDuration", () => {
  it.each([
    ["PT59S", 59],
    ["PT1M30S", 90],
    ["PT3M1S", 181],
    ["PT1H2M", 3720],
    ["P1DT2H", 93600],
  ])("parses %s", (iso, seconds) => {
    expect(parseIsoDuration(iso)).toBe(seconds);
  });

  it("returns null for garbage", () => {
    expect(parseIsoDuration("3:01")).toBeNull();
  });
});
