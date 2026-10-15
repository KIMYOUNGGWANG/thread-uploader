// ReportTourScenes.tsx — "what the paid report tells you" scenes for the PromoReportTour format.
// Every chart value comes from the PromoSnapshot prop, produced by the real cosmicpath engines
// for a fictional persona (scripts/extract-report-data.ts).
// Only section titles/labels are copy; no number here is typed by hand.
import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { timelineExtremes, type PromoSnapshot } from "../promo/snapshot.ts";
import type { PromoTopic } from "../promo/types.ts";
import { ziweiNote } from "../promo/copy.ts";
import { C, textBase, useEnter, useExit, type PromoLang } from "./PromoKit";

type Element = "wood" | "fire" | "earth" | "metal" | "water";
type Phase = "ATTACK" | "HARVEST" | "NEGOTIATE" | "DEFEND";

export const TOUR_TOTAL = 5;

const TOUR_UI: Record<PromoLang, { kicker: string; sample: string }> = {
  ko: { kicker: "유료 리포트가 알려주는 것", sample: "가상 인물 예시 · 숫자는 엔진 실제 계산값" },
  en: { kicker: "What the paid report tells you", sample: "Fictional sample · numbers are real engine output" },
};

const ELEMENT_COLOR: Record<Element, string> = {
  wood: "#4ade80", fire: "#f87171", earth: "#facc15", metal: "#e5e7eb", water: "#60a5fa",
};
const ELEMENT_LABEL: Record<PromoLang, Record<Element, string>> = {
  ko: { wood: "목", fire: "화", earth: "토", metal: "금", water: "수" },
  en: { wood: "Wood", fire: "Fire", earth: "Earth", metal: "Metal", water: "Water" },
};
// Phase names match the real report UI (premium-report-sections.tsx).
const PHASE_LABEL: Record<PromoLang, Record<Phase, string>> = {
  ko: { ATTACK: "실행", HARVEST: "수확", NEGOTIATE: "조정", DEFEND: "방어" },
  en: { ATTACK: "Act", HARVEST: "Harvest", NEGOTIATE: "Adjust", DEFEND: "Defend" },
};
const PHASE_COLOR: Record<Phase, string> = {
  ATTACK: C.goldHi, HARVEST: C.emerald, NEGOTIATE: C.indigo, DEFEND: C.rose,
};

const STEM_HANJA: Record<string, string> = {
  갑: "甲", 을: "乙", 병: "丙", 정: "丁", 무: "戊", 기: "己", 경: "庚", 신: "辛", 임: "壬", 계: "癸",
};
const BRANCH_HANJA: Record<string, string> = {
  자: "子", 축: "丑", 인: "寅", 묘: "卯", 진: "辰", 사: "巳", 오: "午", 미: "未", 신: "申", 유: "酉", 술: "戌", 해: "亥",
};

function clamp01(frame: number, from: number, to: number): number {
  return interpolate(frame, [from, to], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
}

// ── shared header ────────────────────────────────────────────────────────────
export const TourKicker: React.FC<{ lang: PromoLang; index: number }> = ({ lang, index }) => {
  const p = useEnter(0);
  return (
    <div style={{ position: "absolute", top: 96, width: "100%", display: "flex", justifyContent: "center", opacity: p }}>
      <div style={{ ...textBase, fontSize: 30, fontWeight: 700, color: C.gold, padding: "10px 26px", borderRadius: 999, border: `2px solid ${C.gold}66` }}>
        {TOUR_UI[lang].kicker} · {String(index).padStart(2, "0")}/{String(TOUR_TOTAL).padStart(2, "0")}
      </div>
    </div>
  );
};

const TourHeader: React.FC<{ lang: PromoLang; index: number; title: string }> = ({ lang, index, title }) => {
  const p = useEnter(4);
  return (
    <>
      <TourKicker lang={lang} index={index} />
      <div style={{ position: "absolute", top: 176, width: "100%", opacity: p, transform: `translateY(${(1 - p) * 40}px)` }}>
        <div style={{ ...textBase, fontSize: 72, fontWeight: 900, padding: "0 60px" }}>{title}</div>
        <div style={{ ...textBase, fontSize: 28, color: C.dim, marginTop: 18 }}>{TOUR_UI[lang].sample}</div>
      </div>
    </>
  );
};

type TourProps = { lang: PromoLang; len: number; snapshot: PromoSnapshot; topic: PromoTopic };

// ── 01 Four pillars + element balance ────────────────────────────────────────
const PILLAR_ORDER = [
  { key: "hour", ko: "시주", en: "Hour", elementIndex: 3 },
  { key: "day", ko: "일주", en: "Day", elementIndex: 2 },
  { key: "month", ko: "월주", en: "Month", elementIndex: 1 },
  { key: "year", ko: "연주", en: "Year", elementIndex: 0 },
] as const;

const GlyphBox: React.FC<{ glyph: string; element: Element; delay: number }> = ({ glyph, element, delay }) => {
  const p = useEnter(delay, 12);
  const color = ELEMENT_COLOR[element];
  return (
    <div style={{ width: 190, height: 190, borderRadius: 28, border: `4px solid ${color}`, background: `${color}1f`, boxShadow: `0 0 40px ${color}44`, display: "flex", justifyContent: "center", alignItems: "center", opacity: p, transform: `rotateY(${(1 - p) * 90}deg)` }}>
      <span style={{ fontFamily: "serif", fontSize: 120, fontWeight: 700, color }}>{glyph}</span>
    </div>
  );
};

function elementCounts(snapshot: PromoSnapshot): Record<Element, number> {
  const counts: Record<Element, number> = { wood: 0, fire: 0, earth: 0, metal: 0, water: 0 };
  for (const e of snapshot.saju.elements) {
    counts[e.stem as Element] += 1;
    counts[e.branch as Element] += 1;
  }
  return counts;
}

const ElementBars: React.FC<{ lang: PromoLang; snapshot: PromoSnapshot }> = ({ lang, snapshot }) => {
  const frame = useCurrentFrame();
  const counts = elementCounts(snapshot);
  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "flex-end", gap: 34, height: 260 }}>
      {(Object.keys(counts) as Element[]).map((el, i) => {
        const grow = clamp01(frame, 50 + i * 5, 70 + i * 5);
        return (
          <div key={el} style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 140 }}>
            <div style={{ ...textBase, fontSize: 40, fontWeight: 800, color: ELEMENT_COLOR[el], opacity: grow }}>{counts[el]}</div>
            <div style={{ width: 70, height: counts[el] * 55 * grow + 6, borderRadius: 14, background: ELEMENT_COLOR[el], marginTop: 10 }} />
            <div style={{ ...textBase, fontSize: 32, fontWeight: 700, marginTop: 14 }}>{ELEMENT_LABEL[lang][el]}</div>
          </div>
        );
      })}
    </div>
  );
};

export const SajuTourScene: React.FC<TourProps> = ({ lang, len, snapshot }) => {
  const title = lang === "ko" ? "타고난 구조: 사주 4주 · 오행" : "Four Pillars · Elements";
  const label = lang === "ko" ? "8글자 중 오행 분포" : "Element count across 8 characters";
  return (
    <AbsoluteFill style={{ opacity: useExit(len) }}>
      <TourHeader lang={lang} index={1} title={title} />
      <div style={{ position: "absolute", top: 470, width: "100%", display: "flex", justifyContent: "center", gap: 26, perspective: 1200 }}>
        {PILLAR_ORDER.map((p, i) => {
          const pillar = snapshot.saju.pillars[p.key];
          const el = snapshot.saju.elements[p.elementIndex];
          return (
            <div key={p.key} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
              <div style={{ ...textBase, fontSize: 34, fontWeight: 700, color: p.key === "day" ? C.goldHi : C.dim }}>{p[lang]}</div>
              <GlyphBox glyph={STEM_HANJA[pillar.stem] ?? pillar.stem} element={(el?.stem ?? "metal") as Element} delay={8 + i * 5} />
              <GlyphBox glyph={BRANCH_HANJA[pillar.branch] ?? pillar.branch} element={(el?.branch ?? "metal") as Element} delay={12 + i * 5} />
            </div>
          );
        })}
      </div>
      <div style={{ position: "absolute", top: 1150, width: "100%" }}>
        <div style={{ ...textBase, fontSize: 34, color: C.dim, marginBottom: 30 }}>{label}</div>
        <ElementBars lang={lang} snapshot={snapshot} />
      </div>
    </AbsoluteFill>
  );
};

// ── 02 A vs B, next 12 months ────────────────────────────────────────────────
type FlowBarProps = { point: { label: string; action: number }; index: number; tone: string | null; year: number | undefined; prevYear: number | undefined };

const FlowBar: React.FC<FlowBarProps> = ({ point, index, tone, year, prevYear }) => {
  const frame = useCurrentFrame();
  const grow = clamp01(frame, 20 + index * 4, 44 + index * 4);
  const color = tone ?? "rgba(245,241,232,0.28)";
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", width: 66, height: 640 }}>
      {tone ? <div style={{ ...textBase, fontSize: 40, fontWeight: 900, color: tone, opacity: grow, marginBottom: 10 }}>{point.action}</div> : null}
      <div style={{ width: 46, height: point.action * 5.4 * grow, borderRadius: 12, background: color, boxShadow: tone ? `0 0 40px ${tone}88` : "none" }} />
      <div style={{ ...textBase, fontSize: 26, color: tone ?? C.dim, marginTop: 12, whiteSpace: "nowrap", fontWeight: tone ? 800 : 500 }}>{point.label.split(" ")[0]}</div>
      <div style={{ ...textBase, fontSize: 22, color: C.gold, marginTop: 6, height: 26 }}>{year !== prevYear ? `'${String(year).slice(2)}` : ""}</div>
    </div>
  );
};

export const FlowTourScene: React.FC<TourProps> = ({ lang, len, snapshot }) => {
  const frame = useCurrentFrame();
  const s = snapshot.scenario;
  const months = snapshot.heatmap.months;
  const { strongest: peak, weakest: low } = timelineExtremes(s.timeline);
  const headline = useEnter(80, 12);
  const title = lang === "ko" ? "다음 12개월, 언제 움직일지" : "When to move, by month";
  const axis = lang === "ko" ? "월별 행동 지수 · A안 vs B안" : "Monthly action index · A vs B";
  return (
    <AbsoluteFill style={{ opacity: useExit(len) }}>
      <TourHeader lang={lang} index={2} title={title} />
      <div style={{ position: "absolute", top: 420, width: "100%", ...textBase, fontSize: 30, color: C.dim, opacity: clamp01(frame, 10, 20) }}>{axis}</div>
      <div style={{ position: "absolute", top: 480, width: "100%", display: "flex", justifyContent: "center", gap: 14 }}>
        {s.timeline.map((p, i) => (
          <FlowBar key={p.label} point={p} index={i} year={months[i]?.year} prevYear={months[i - 1]?.year} tone={i === peak ? C.goldHi : i === low ? C.rose : null} />
        ))}
      </div>
      <div style={{ position: "absolute", top: 1250, width: "100%", padding: "0 70px", opacity: headline, transform: `scale(${0.85 + headline * 0.15})` }}>
        <div style={{ ...textBase, fontSize: 50, fontWeight: 900, color: C.goldHi, lineHeight: 1.3 }}>{s.headline}</div>
      </div>
    </AbsoluteFill>
  );
};

// ── 03 Timing heatmap: month phases + best day ───────────────────────────────
const MonthTile: React.FC<{ lang: PromoLang; index: number; month: PromoSnapshot["heatmap"]["months"][number] }> = ({ lang, index, month }) => {
  const p = useEnter(10 + index * 3, 13);
  const phase = month.phase as Phase;
  const color = PHASE_COLOR[phase];
  const name = lang === "ko" ? `${month.year % 100}.${month.month}월` : `${month.nameEn.slice(0, 3)} '${month.year % 100}`;
  return (
    <div style={{ width: 300, height: 170, borderRadius: 24, background: `${color}1c`, border: `3px solid ${color}`, opacity: p, transform: `scale(${0.6 + p * 0.4})`, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center" }}>
      <div style={{ ...textBase, fontSize: 32, fontWeight: 700, color: C.text }}>{name}</div>
      <div style={{ ...textBase, fontSize: 44, fontWeight: 900, color, marginTop: 6 }}>{PHASE_LABEL[lang][phase]} · {month.average}</div>
    </div>
  );
};

export const HeatmapTourScene: React.FC<TourProps> = ({ lang, len, snapshot }) => {
  const best = snapshot.heatmap.bestDay;
  const pin = useEnter(62, 11);
  const title = lang === "ko" ? "좋은 날, 조심할 날까지" : "Good days, risky days";
  const bestLabel = lang === "ko" ? "가장 강한 날" : "Strongest day";
  const reason = lang === "ko" ? best?.reasonKo : best?.reasonEn;
  return (
    <AbsoluteFill style={{ opacity: useExit(len) }}>
      <TourHeader lang={lang} index={3} title={title} />
      <div style={{ position: "absolute", top: 420, left: 60, width: 960, display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 18 }}>
        {snapshot.heatmap.months.map((m, i) => (
          <MonthTile key={`${m.year}-${m.month}`} lang={lang} index={i} month={m} />
        ))}
      </div>
      {best ? (
        <div style={{ position: "absolute", top: 1220, left: 90, width: 900, padding: "36px 40px", borderRadius: 32, background: C.card, border: `4px solid ${C.goldHi}`, boxShadow: `0 0 80px ${C.gold}66`, opacity: pin, transform: `translateY(${(1 - pin) * 120}px)` }}>
          <div style={{ ...textBase, fontSize: 30, color: C.gold, fontWeight: 700 }}>{bestLabel}</div>
          <div style={{ ...textBase, fontSize: 60, fontWeight: 900, marginTop: 8 }}>{best.date} · {best.score}</div>
          <div style={{ ...textBase, fontSize: 32, color: C.dim, marginTop: 12 }}>{reason}</div>
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

// ── 04 Ziwei 12 palaces ──────────────────────────────────────────────────────
// Traditional chart layout: branches run clockwise around a 4x4 ring.
const BRANCH_CELL: Record<string, [number, number]> = {
  巳: [0, 0], 午: [0, 1], 未: [0, 2], 申: [0, 3], 辰: [1, 0], 酉: [1, 3],
  卯: [2, 0], 戌: [2, 3], 寅: [3, 0], 丑: [3, 1], 子: [3, 2], 亥: [3, 3],
};
const CELL = 236;
// The palace each question topic is about; 관록궁 = career, 부처궁 = spouse/romance.
const FOCUS_PALACE_BY_TOPIC: Record<PromoTopic, string> = {
  career: "관록궁", sideJob: "재백궁", partnership: "노복궁", contact: "부처궁", confession: "부처궁", marriage: "부처궁",
};
const PALACE_MEANING: Record<string, { ko: string; en: string }> = {
  관록궁: { ko: "직업", en: "Career" }, 재백궁: { ko: "돈", en: "Wealth" }, 노복궁: { ko: "동료·파트너", en: "Partners" }, 부처궁: { ko: "연애·배우자", en: "Spouse" },
};

type PalaceCellProps = { lang: PromoLang; index: number; palace: PromoSnapshot["ziwei"]["palaces"][number]; focusPalace: string };

const PalaceCell: React.FC<PalaceCellProps> = ({ lang, index, palace, focusPalace }) => {
  const frame = useCurrentFrame();
  const p = useEnter(8 + index * 3, 14);
  const focus = palace.name === focusPalace && frame > 60;
  const [row, col] = BRANCH_CELL[palace.branch] ?? [0, 0];
  const mains = palace.stars.filter((s) => s.category === "main").map((s) => s[lang]);
  return (
    <div style={{ position: "absolute", left: col * (CELL + 8), top: row * (CELL + 8), width: CELL, height: CELL, borderRadius: 18, padding: 16, boxSizing: "border-box", background: focus ? "rgba(245,215,127,0.16)" : C.card, border: `3px solid ${focus ? C.goldHi : C.border}`, boxShadow: focus ? `0 0 60px ${C.gold}99` : "none", opacity: p, transform: `scale(${(0.7 + p * 0.3) * (focus ? 1.06 : 1)})` }}>
      <div style={{ ...textBase, textAlign: "left", fontSize: 36, fontWeight: 800, color: focus ? C.goldHi : C.text }}>{lang === "ko" ? palace.name : palace.nameEn}</div>
      <div style={{ ...textBase, textAlign: "left", fontSize: 30, color: "#c4b5fd", marginTop: 10, lineHeight: 1.3, whiteSpace: "pre-line" }}>{mains.join(lang === "ko" ? " · " : "\n") || "—"}</div>
      <div style={{ position: "absolute", right: 14, bottom: 8, fontFamily: "serif", fontSize: 34, color: C.dim }}>{palace.branch}</div>
    </div>
  );
};

export const ZiweiTourScene: React.FC<TourProps> = ({ lang, len, snapshot, topic }) => {
  const callout = useEnter(64, 12);
  const z = snapshot.ziwei;
  const focusPalace = FOCUS_PALACE_BY_TOPIC[topic];
  const meaning = PALACE_MEANING[focusPalace] ?? { ko: "", en: "" };
  const title = lang === "ko" ? "삶의 12영역: 자미두수 명반" : "Ziwei: 12 life areas";
  const center = lang === "ko" ? [`명궁 ${z.mingGongBranch}`, z.wuxingJu] : [`Life palace ${z.mingGongBranch}`, `${z.wuxingJuEn} bureau`];
  const focus = z.palaces.find((p) => p.name === focusPalace);
  const stars = (focus?.stars ?? []).filter((s) => s.category === "main").map((s) => s[lang]);
  const note = ziweiNote(lang, topic, { palace: focusPalace, meaningKo: meaning.ko, meaningEn: meaning.en, stars, quan: z.quanPalace === focusPalace });
  return (
    <AbsoluteFill style={{ opacity: useExit(len) }}>
      <TourHeader lang={lang} index={4} title={title} />
      <div style={{ position: "absolute", top: 420, left: (1080 - (CELL * 4 + 24)) / 2, width: CELL * 4 + 24, height: CELL * 4 + 24 }}>
        {z.palaces.map((p, i) => (
          <PalaceCell key={p.name} lang={lang} index={i} palace={p} focusPalace={focusPalace} />
        ))}
        <div style={{ position: "absolute", left: CELL + 8, top: CELL + 8, width: CELL * 2 + 8, height: CELL * 2 + 8, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center" }}>
          <div style={{ ...textBase, fontSize: 52, fontWeight: 900, color: "#c4b5fd" }}>{center[0]}</div>
          <div style={{ ...textBase, fontSize: 40, color: C.dim, marginTop: 12 }}>{center[1]}</div>
        </div>
      </div>
      <div style={{ position: "absolute", top: 1440, width: "100%", padding: "0 60px", opacity: callout, transform: `translateY(${(1 - callout) * 40}px)` }}>
        <div style={{ ...textBase, fontSize: 42, fontWeight: 900, color: C.goldHi, lineHeight: 1.3 }}>{note}</div>
      </div>
    </AbsoluteFill>
  );
};
