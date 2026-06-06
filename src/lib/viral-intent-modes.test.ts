import { describe, expect, it } from "vitest";
import { selectViralIntentMode } from "./viral-intent-modes";

describe("viral intent mode rotation", () => {
  it("cycles a 28-post sprint into four 7-post mode groups", () => {
    const counts = Array.from({ length: 28 }, (_, index) => selectViralIntentMode(index).id)
      .reduce<Record<string, number>>((result, modeId) => {
        result[modeId] = (result[modeId] ?? 0) + 1;
        return result;
      }, {});

    expect(counts).toEqual({
      self_classification: 7,
      saveable_tool: 7,
      quiet_contrarian: 7,
      friend_share: 7,
    });
  });
});
