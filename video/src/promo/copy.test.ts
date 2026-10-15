import { describe, expect, it } from "vitest";
import {
  BANNED_PHRASES, HOOKS, TOPIC_COPY, UI_COPY,
  buildCaption, buildCommentTemplate, hookLines, landingPathFor,
} from "./copy.ts";
import { pickPromoVariant, FORMATS, TOPICS } from "./rotation.ts";
import type { PromoLang, PromoVariant } from "./types.ts";

const LANGS: PromoLang[] = ["ko", "en"];
const allVariants = (): PromoVariant[] =>
  LANGS.flatMap((lang) =>
    FORMATS.flatMap((format) =>
      TOPICS.map((topic) => ({ ...pickPromoVariant("2026-10-19", lang), format, topic })),
    ),
  );

const allText = (): string[] => [
  ...JSON.stringify([TOPIC_COPY, HOOKS, UI_COPY]).split('"'),
  ...allVariants().flatMap((variant) => [buildCaption(variant), ...hookLines(variant)]),
  ...LANGS.flatMap((lang) => FORMATS.map((format) => buildCommentTemplate(lang, format))),
];

describe("promo copy", () => {
  it("has three hooks of one to three lines per language and format", () => {
    for (const lang of LANGS) for (const format of FORMATS) {
      expect(HOOKS[lang][format]).toHaveLength(3);
      for (const hook of HOOKS[lang][format]) expect(hook.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("keeps every caption within the 480-char Threads part limit and adds the disclaimer", () => {
    for (const variant of allVariants()) {
      const caption = buildCaption(variant);
      expect([...caption].length).toBeLessThanOrEqual(480);
      expect(caption).toContain(variant.lang === "ko" ? "숫자는 엔진 실제 계산값" : "real engine numbers");
    }
  });

  it("resolves every {question} placeholder", () => {
    for (const variant of allVariants()) {
      expect([buildCaption(variant), ...hookLines(variant)].join(" ")).not.toMatch(/\{question\}/);
    }
  });

  it("never uses banned phrases or percentages", () => {
    for (const text of allText()) {
      for (const phrase of BANNED_PHRASES) expect(text).not.toContain(phrase);
      expect(text).not.toMatch(/\d\s*%/);
    }
  });

  it("puts a link placeholder in every first comment", () => {
    for (const lang of LANGS) for (const format of FORMATS) {
      expect(buildCommentTemplate(lang, format)).toContain("{{link}}");
    }
  });

  it("sends the match format to the love funnel and the rest to /start", () => {
    expect(landingPathFor("match")).toBe("/start?context=love");
    for (const format of ["reportTour", "race", "experiment"] as const) expect(landingPathFor(format)).toBe("/start");
  });
});
