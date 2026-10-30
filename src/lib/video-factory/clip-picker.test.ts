import { expect, it } from "vitest";
import { pickClip } from "./clip-picker";

const now = new Date("2026-10-30T00:00:00Z");
const day = 86_400_000;
it("skips clips used in the last 7 days, then prefers lower usedCount, then older lastUsedAt", () => {
  const clips = [
    { id: "recent", usedCount: 0, lastUsedAt: new Date(now.getTime() - 2 * day) },
    { id: "busy", usedCount: 5, lastUsedAt: new Date(now.getTime() - 20 * day) },
    { id: "freshA", usedCount: 1, lastUsedAt: new Date(now.getTime() - 9 * day) },
    { id: "freshB", usedCount: 1, lastUsedAt: new Date(now.getTime() - 30 * day) },
  ];
  expect(pickClip(clips, now)?.id).toBe("freshB");
});
it("uses the oldest clip when every clip was used in the last 7 days", () => {
  const clips = [
    { id: "a", usedCount: 3, lastUsedAt: new Date(now.getTime() - 1 * day) },
    { id: "b", usedCount: 9, lastUsedAt: new Date(now.getTime() - 6 * day) },
  ];
  expect(pickClip(clips, now)?.id).toBe("b");
});
it("treats never-used clips as eligible", () => {
  expect(pickClip([{ id: "n", usedCount: 0, lastUsedAt: null }], now)?.id).toBe("n");
});
it("returns null when there are no enabled clips", () => {
  expect(pickClip([], now)).toBeNull();
});
