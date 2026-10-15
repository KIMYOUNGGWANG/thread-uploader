// extract-report-data.ts — run cosmicpath's real engines for one promo variant and write a PromoSnapshot.
// The persona is fictional; every number in the video comes from this run.
// Engines are called through the same entry points production uses (paid report: calculateOracleSajuProfile;
// /match: calculateCompatibility with an offset datetime). Production runs on UTC, so run with TZ=UTC.
// cosmicpath's engine files need its own TS require hook (registerTypeScriptLoader): plain type stripping
// cannot load modules that import types as values.
//   cd <cosmicpath> && TZ=UTC node <thread-uploader>/video/scripts/extract-report-data.ts --input in.json --out out.json
import { createRequire } from "node:module";
import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import type { Persona, PromoVariant } from "../src/promo/types.ts";
import type { PromoSnapshot } from "../src/promo/snapshot.ts";

interface ExtractInput { variant: PromoVariant; scenarioA: string; scenarioB: string; question: string }

const { values } = parseArgs({ options: { input: { type: "string" }, out: { type: "string" } } });
if (!values.input || !values.out) throw new Error("usage: --input variant-input.json --out snapshot.json");

const root = process.cwd();
const { registerTypeScriptLoader } = await import(pathToFileURL(`${root}/scripts/report-test-data/ts-loader.ts`).href);
registerTypeScriptLoader();
const load = createRequire(`${root}/package.json`);
// require() is untyped at this cross-repo boundary (engine types live in cosmicpath). The fields read
// below are checked by parsePromoSnapshot + validateSnapshot before anything is rendered.
const engine = (file: string) => load(`${root}/src/${file}`);
const { calculateOracleSajuProfile } = engine("lib/saju/saju-engine.ts");
const { mapToLegacySaju } = engine("app/api/reading/route-helpers.ts");
const { calculateRollingTimingHeatmap } = engine("lib/engines/timing-heatmap.ts");
const { calculateScenarioDecision, getPeakActionPoint } = engine("lib/engines/scenario-engine.ts");
const { calculateZiweiChart } = engine("lib/engines/ziwei.ts");
const { ziweiPalaceToEnglish, ziweiStarToEnglish, ziweiBureauToEnglish } = engine("lib/saju-terms-en.ts");
const { calculateCompatibility } = engine("lib/match/match-calculator.ts");

const input: ExtractInput = JSON.parse(readFileSync(values.input, "utf8"));
const { variant } = input;
const [asOfYear, asOfMonth] = variant.date.split("-").map(Number);

async function sajuFor(persona: Persona) {
  const profile = await calculateOracleSajuProfile({ birthDate: persona.birthDate, birthTime: persona.birthTime, gender: persona.gender, cityName: "Seoul" });
  return mapToLegacySaju(profile);
}

function englishHeadline(recommended: string, peakLabel: string | null): string {
  const lean = recommended === "OPTION_A" ? "Option A shows the stronger flow"
    : recommended === "OPTION_B" ? "Option B shows the stronger flow" : "Neither option clearly leads";
  return `${lean} — watch ${peakLabel ?? ""}`;
}

function matchFor(host: Persona, guest: Persona): PromoSnapshot["match"] {
  const at = (persona: Persona) => new Date(`${persona.birthDate}T${persona.birthTime}:00+09:00`);
  const result = calculateCompatibility(
    { name: "A", birthDate: at(host), timezone: "Asia/Seoul", gender: host.gender },
    { name: "B", birthDate: at(guest), timezone: "Asia/Seoul", gender: guest.gender },
  );
  return {
    overall: result.overallScore, saju: result.sajuScore, astro: result.astroScore, num: result.numScore,
    hostElement: result.hostElement, guestElement: result.guestElement, hostSign: result.hostSign, guestSign: result.guestSign,
    hostDayMaster: result.hostDayMaster, guestDayMaster: result.guestDayMaster, tianganHe: Boolean(result.tianganHe), dizhiChong: Boolean(result.dizhiChong),
  };
}

const saju = await sajuFor(variant.persona);
const heatmap = calculateRollingTimingHeatmap(saju, asOfYear, asOfMonth, variant.date);
const scenario = calculateScenarioDecision({
  scenarioA: input.scenarioA, scenarioB: input.scenarioB, question: input.question,
  weeklyHeatmap: heatmap, saju, targetYear: asOfYear, startMonth: asOfMonth, language: variant.lang,
});
const peak = getPeakActionPoint(scenario);
const peakLabel: string | null = peak ? (variant.lang === "ko" ? peak.formattedLabelKo : peak.formattedLabelEn) : null;
// Same call the paid report's Ziwei chart makes (premium-report.tsx).
const ziwei = calculateZiweiChart(new Date(variant.persona.birthDate), Number(variant.persona.birthTime.slice(0, 2)), variant.persona.gender);
const pillar = (value: { stem: string; branch: string }) => ({ stem: value.stem, branch: value.branch });

const snapshot: PromoSnapshot = {
  asOf: variant.date,
  lang: variant.lang,
  persona: variant.persona,
  guest: variant.format === "match" ? variant.guest : null,
  saju: {
    dayMaster: saju.dayMaster,
    pillars: { hour: pillar(saju.hourPillar), day: pillar(saju.dayPillar), month: pillar(saju.monthPillar), year: pillar(saju.yeonPillar) },
    elements: saju.elements,
  },
  heatmap: {
    bestDay: heatmap.bestDay ? { date: heatmap.bestDay.date, score: heatmap.bestDay.score, reasonKo: heatmap.bestDay.reasonKo, reasonEn: heatmap.bestDay.reasonEn } : null,
    months: heatmap.months.map((month: { year: number; month: number; monthNameEn: string; averageScore: number; dominantPhase: string }) => ({
      year: month.year, month: month.month, nameEn: month.monthNameEn, average: month.averageScore, phase: month.dominantPhase,
    })),
  },
  scenario: {
    headline: variant.lang === "ko" ? scenario.verdictHeadlineKo : englishHeadline(scenario.recommendedOption, peakLabel),
    peakLabel,
    timeline: scenario.timeline.map((point: { formattedLabelKo: string; formattedLabelEn: string; actionScore: number; bestOption: "A" | "B" | "EQUAL" }) => ({
      label: variant.lang === "ko" ? point.formattedLabelKo : point.formattedLabelEn, action: point.actionScore, best: point.bestOption,
    })),
  },
  ziwei: {
    mingGongBranch: ziwei.mingGongBranch,
    wuxingJu: ziwei.wuxingJu.name,
    wuxingJuEn: ziweiBureauToEnglish(ziwei.wuxingJu.name),
    quanPalace: ziwei.siHuaSummary["화권"].palace,
    palaces: ziwei.palaceList.map((palace: { name: string; branch: string; stars: Array<{ name: string; nameEn?: string; category: string }> }) => ({
      name: palace.name, nameEn: ziweiPalaceToEnglish(palace.name), branch: palace.branch,
      stars: palace.stars.map((star) => ({ ko: star.name, en: star.nameEn ?? ziweiStarToEnglish(star.name), category: star.category })),
    })),
  },
  match: variant.format === "match" ? matchFor(variant.persona, variant.guest) : null,
};

writeFileSync(values.out, `${JSON.stringify(snapshot, null, 2)}\n`);
console.log(`wrote ${values.out}`);
