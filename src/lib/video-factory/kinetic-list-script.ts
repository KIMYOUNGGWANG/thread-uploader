import { getDomainPreset } from "@/lib/domain-registry";
import { hasForbiddenCta } from "@/lib/tiktok/tiktok-script-engine";

export const KINETIC_GLYPHS = "甲乙丙丁戊己庚辛壬癸";

export interface KineticItem {
  glyph: string;
  label: string;
  action: [string, string];
}

export interface KineticListScript {
  hook: { kicker: string; lines: [string, string] };
  intro: { l1: string; l2: string };
  items: [KineticItem, KineticItem, KineticItem];
  cta: { l1: string; l2: string };
  captions: { instagram: string; youtube: string; tiktok: string };
  hashtags: string[];
}

export type ScriptCheck =
  | { ok: true; script: KineticListScript }
  | { ok: false; errors: string[] };

const len = (s: string) => [...s].length;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function forbiddenTermsFor(qualityProfile: string): string[] {
  const preset = getDomainPreset(qualityProfile);
  const terms = new Set<string>(preset.forbiddenCrossDomainTerms);
  for (const formulas of Object.values(preset.trackFormulas)) {
    for (const f of formulas) for (const k of f.forbiddenKeywords) terms.add(k);
  }
  return [...terms];
}

export function checkKineticListScript(input: unknown, forbiddenTerms: string[]): ScriptCheck {
  if (!isRecord(input)) return { ok: false, errors: ["script: 객체가 아님"] };
  const errors: string[] = [];
  // 화면 글자와 캡션 전부 (금지어 검사 대상)
  const texts: Array<[string, string]> = [];

  const str = (path: string, v: unknown, max?: number): string => {
    if (typeof v !== "string" || v.trim() === "") {
      errors.push(`${path}: 비어 있거나 문자열이 아님`);
      return "";
    }
    if (max !== undefined && len(v) > max) errors.push(`${path}: "${v}" ${len(v)}자 > ${max}자`);
    texts.push([path, v]);
    return v;
  };
  const obj = (path: string, v: unknown): Record<string, unknown> => {
    if (isRecord(v)) return v;
    errors.push(`${path}: 객체가 아님`);
    return {};
  };
  const pair = (path: string, v: unknown, max: number) => {
    if (!Array.isArray(v) || v.length !== 2) {
      errors.push(`${path}: 2줄 필요`);
      return;
    }
    v.forEach((line, i) => str(`${path}[${i}]`, line, max));
  };

  const hook = obj("hook", input.hook);
  str("hook.kicker", hook.kicker, 6);
  pair("hook.lines", hook.lines, 6);

  const intro = obj("intro", input.intro);
  str("intro.l1", intro.l1, 6);
  str("intro.l2", intro.l2, 6);

  if (!Array.isArray(input.items) || input.items.length !== 3) {
    errors.push("items: 3개 필요");
  } else {
    input.items.forEach((raw, i) => {
      const p = `items[${i}]`;
      const item = obj(p, raw);
      if (typeof item.glyph !== "string" || len(item.glyph) !== 1 || !KINETIC_GLYPHS.includes(item.glyph)) {
        errors.push(`${p}.glyph: ${String(item.glyph)}`);
      }
      const label = str(`${p}.label`, item.label, 4);
      // Template fonts carry Hanja only for the 10 glyphs; any other Hanja renders as tofu on CI.
      if (label && !/^[가-힣]+$/.test(label)) errors.push(`${p}.label: 한글만`);
      pair(`${p}.action`, item.action, 10);
    });
  }

  const cta = obj("cta", input.cta);
  const ctaL1 = str("cta.l1", cta.l1, 10);
  const ctaL2 = str("cta.l2", cta.l2, 12);

  const captions = obj("captions", input.captions);
  const capTexts: Array<[string, string]> = (["instagram", "youtube", "tiktok"] as const).map((k) => [
    `captions.${k}`,
    str(`captions.${k}`, captions[k]),
  ]);

  if (!Array.isArray(input.hashtags) || !input.hashtags.every((h) => typeof h === "string")) {
    errors.push("hashtags: 문자열 배열이 아님");
  }

  for (const [path, text] of [["cta.l1", ctaL1], ["cta.l2", ctaL2], ...capTexts]) {
    if (hasForbiddenCta(text)) errors.push(`${path}: 금지된 CTA (DM·댓글 달면)`);
  }
  for (const [path, text] of texts) {
    const hit = forbiddenTerms.find((t) => text.includes(t));
    if (hit) errors.push(`${path}: 금지어 "${hit}"`);
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, script: input as unknown as KineticListScript };
}
