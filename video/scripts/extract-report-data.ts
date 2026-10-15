// extract-report-data.ts — snapshot real CosmicPath engine output for the promo video.
// The persona is fictional; every number in the video comes from this run, not from copy.
// Run from the cosmicpath repo (it owns the engines + alias loader):
//   cd ../cosmicpath && node --experimental-transform-types --import ./scripts/alias-loader.mjs \
//     ../threads-uploader/video/scripts/extract-report-data.ts
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { calculateSaju } from '@/lib/engines/saju';
import { calculateRollingTimingHeatmap } from '@/lib/engines/timing-heatmap';
import { calculateScenarioDecision, getPeakActionPoint } from '@/lib/engines/scenario-engine';
import { calculateZiweiChart } from '@/lib/engines/ziwei';
import { ziweiPalaceToEnglish, ziweiStarToEnglish, ziweiBureauToEnglish } from '@/lib/saju-terms-en';

const PERSONA = { birthDate: '1996-03-14', hour: 10, minute: 30, gender: 'female' as const };
const AS_OF = { year: 2026, month: 10, date: '2026-10-14' };
const SCENARIOS = {
  ko: { a: '지금 이직 준비 시작', b: '6개월 버티며 성과 쌓기', question: '이직할까, 버틸까?' },
  en: { a: 'Start job hunting now', b: 'Stay 6 months, build results', question: 'Quit my job, or stay?' },
};

const saju = calculateSaju(new Date(`${PERSONA.birthDate}T00:00:00+09:00`), PERSONA.hour, PERSONA.minute, false, PERSONA.gender);
const heatmap = calculateRollingTimingHeatmap(saju, AS_OF.year, AS_OF.month, AS_OF.date);
const ziwei = calculateZiweiChart(new Date(PERSONA.birthDate), PERSONA.hour, PERSONA.gender);

function scenarioFor(language: 'ko' | 'en') {
  const s = SCENARIOS[language];
  const result = calculateScenarioDecision({
    scenarioA: s.a, scenarioB: s.b, question: s.question, weeklyHeatmap: heatmap,
    saju, targetYear: AS_OF.year, startMonth: AS_OF.month, language,
  });
  const peak = getPeakActionPoint(result);
  return {
    headline: language === 'ko' ? result.verdictHeadlineKo : result.verdictHeadlineEn,
    peakLabel: peak ? (language === 'ko' ? peak.formattedLabelKo : peak.formattedLabelEn) : null,
    goldenWindows: result.goldenWindows.map((w) => (language === 'ko' ? w.labelKo : w.labelEn)),
    timeline: result.timeline.map((p) => ({
      label: language === 'ko' ? p.formattedLabelKo : p.formattedLabelEn,
      action: p.actionScore, risk: p.riskScore, phase: p.phase, best: p.bestOption,
    })),
  };
}

const pillar = (p: { stem: string; branch: string }) => ({ stem: p.stem, branch: p.branch });

const snapshot = {
  persona: PERSONA,
  asOf: AS_OF.date,
  saju: {
    dayMaster: saju.dayMaster,
    pillars: { hour: pillar(saju.hourPillar), day: pillar(saju.dayPillar), month: pillar(saju.monthPillar), year: pillar(saju.yeonPillar) },
    elements: saju.elements,
  },
  heatmap: {
    peakQuarter: heatmap.peakQuarter,
    bestDay: heatmap.bestDay,
    months: heatmap.months.map((m) => ({
      year: m.year, month: m.month, nameKo: m.monthNameKo, nameEn: m.monthNameEn,
      tenGod: m.tenGod, average: m.averageScore, phase: m.dominantPhase,
      opportunityKo: m.keyOpportunityKo, opportunityEn: m.keyOpportunityEn,
      goldenDays: m.goldenDays.map((d) => d.date), cautionDays: m.cautionDays.map((d) => d.date),
    })),
  },
  scenario: { ko: scenarioFor('ko'), en: scenarioFor('en') },
  ziwei: {
    mingGongBranch: ziwei.mingGongBranch,
    wuxingJu: ziwei.wuxingJu.name,
    wuxingJuEn: ziweiBureauToEnglish(ziwei.wuxingJu.name),
    palaces: ziwei.palaceList.map((p) => ({ name: p.name, nameEn: ziweiPalaceToEnglish(p.name), branch: p.branch, stars: p.stars.map((s) => ({ ko: s.name, en: s.nameEn ?? ziweiStarToEnglish(s.name), category: s.category })), isShenGong: p.isShenGong })),
    siHua: ziwei.siHuaSummary,
  },
};

const out = join(dirname(fileURLToPath(import.meta.url)), '../src/data/promo-report-data.json');
writeFileSync(out, `${JSON.stringify(snapshot, null, 2)}\n`);
console.log(`wrote ${out}`);
