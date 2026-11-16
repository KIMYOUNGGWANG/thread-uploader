import { expect, it } from "vitest";
import { kstDate } from "./kst";

it("rolls over at 15:00 UTC", () => {
  expect(kstDate(new Date("2026-10-29T14:59:59Z"))).toBe("2026-10-29");
  expect(kstDate(new Date("2026-10-29T15:00:00Z"))).toBe("2026-10-30");
});
