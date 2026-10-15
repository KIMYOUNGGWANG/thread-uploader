import { describe, expect, it } from "vitest";
import { pickPromoVariant, slotDateFor, slotFor } from "./rotation.ts";
import { RELATION_TOPICS } from "./types.ts";

const addDays = (date: string, days: number) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

describe("slotFor", () => {
  it("counts Monday/Thursday slots from 2026-10-19", () => {
    expect(slotFor("2026-10-19")).toBe(0);
    expect(slotFor("2026-10-22")).toBe(1);
    expect(slotFor("2026-10-26")).toBe(2);
  });

  it("maps a non-slot weekday to the previous slot", () => {
    expect(slotFor("2026-10-20")).toBe(slotFor("2026-10-19"));
    expect(slotFor("2026-10-25")).toBe(slotFor("2026-10-22"));
  });

  it("clamps dates before the rotation start to slot 0", () => {
    expect(slotFor("2026-10-15")).toBe(0);
  });

  it("rejects malformed and impossible dates", () => {
    expect(() => slotFor("")).toThrow();
    expect(() => slotFor("2026-13-01")).toThrow();
    expect(() => slotFor("2026-02-30")).toThrow();
  });
});

describe("pickPromoVariant", () => {
  it("is deterministic for the same date and language", () => {
    expect(pickPromoVariant("2026-11-02", "ko")).toEqual(pickPromoVariant("2026-11-02", "ko"));
  });

  it("shows all four formats within two weeks in Korean", () => {
    const formats = [0, 3, 7, 10].map((offset) => pickPromoVariant(addDays("2026-10-19", offset), "ko").format);
    expect(new Set(formats).size).toBe(4);
  });

  it("uses only relationship topics on match slots", () => {
    for (let week = 0; week < 12; week += 1) {
      const variant = pickPromoVariant(addDays("2026-10-26", week * 14), "ko");
      expect(variant.format).toBe("match");
      expect(RELATION_TOPICS).toContain(variant.topic);
    }
  });

  it("replaces match with race in English", () => {
    expect(pickPromoVariant("2026-10-26", "en").format).toBe("race");
    expect(pickPromoVariant("2026-10-26", "en", { format: "match" }).format).toBe("race");
  });

  it("rejects a non-relationship topic override on the match format", () => {
    expect(() => pickPromoVariant("2026-10-26", "ko", { topic: "career" })).toThrow(/relation topic/);
  });

  it("applies format and topic overrides", () => {
    const variant = pickPromoVariant("2026-10-19", "ko", { format: "experiment", topic: "sideJob" });
    expect(variant).toMatchObject({ format: "experiment", topic: "sideJob" });
  });

  it("builds valid personas with opposite-gender guests", () => {
    for (let day = 0; day < 60; day += 1) {
      const { persona, guest } = pickPromoVariant(addDays("2026-10-19", day), "ko");
      for (const person of [persona, guest]) {
        expect(person.birthDate).toMatch(/^(199\d|200[01])-(0[1-9]|1[0-2])-(0[1-9]|1\d|2[0-8])$/);
        expect(person.birthTime).toMatch(/^([01]\d|2[0-3]):(00|30)$/);
      }
      expect(guest.gender).not.toBe(persona.gender);
    }
  });
});

describe("slot identity and diversity", () => {
  it("maps any date to the latest Monday/Thursday slot date", () => {
    expect(slotDateFor("2026-10-19")).toBe("2026-10-19");
    expect(slotDateFor("2026-10-21")).toBe("2026-10-19");
    expect(slotDateFor("2026-10-24")).toBe("2026-10-22");
    expect(slotDateFor("2026-10-01")).toBe("2026-10-19");
  });

  it("reproduces the whole slot variant, persona included, on a non-slot weekday", () => {
    expect(pickPromoVariant("2026-10-20", "ko")).toEqual(pickPromoVariant("2026-10-19", "ko"));
    expect(pickPromoVariant("2026-10-20", "ko").date).toBe("2026-10-19");
  });

  it("rotates every Korean non-match format through all six topics and both genders", () => {
    for (const format of ["reportTour", "race", "experiment"] as const) {
      const variants = Array.from({ length: 104 }, (_, i) => addDays("2026-10-19", i * 3.5 | 0))
        .map((date) => pickPromoVariant(date, "ko"))
        .filter((variant) => variant.format === format);
      expect(new Set(variants.map((variant) => variant.topic)).size).toBe(6);
      expect(new Set(variants.map((variant) => variant.persona.gender)).size).toBe(2);
    }
  });
});
