// PromoRace.tsx — format ②: "A vs B" race over the next 12 months (20s).
// Each month card flips to the side the scenario engine leans (actionScore > 65 → A, < 45 → B);
// the scoreboard tallies the engine's own bestOption values. No number here is typed by hand.
import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { ensurePretendard } from "../load-fonts";
import { C, Shot, Backdrop, textBase, useEnter, useExit } from "../components/PromoKit";
import { HookScene, OutroScene, QuestionScene, SampleNote } from "../components/PromoScenes";
import { TOPIC_COPY, UI_COPY, hookLines, personaLine } from "../promo/copy.ts";
import { timelineExtremes } from "../promo/snapshot.ts";
import type { PromoProps } from "../promo/types.ts";

void ensurePretendard();

const RACE_START = 20;
const MONTH_STEP = 20;
const LEAN_COLOR = { A: C.goldHi, B: C.indigo, EQUAL: "rgba(245,241,232,0.22)" } as const;
type Point = PromoProps["snapshot"]["scenario"]["timeline"][number];

function tally(timeline: Point[], revealed: number) {
  const shown = timeline.slice(0, revealed);
  return { a: shown.filter((p) => p.best === "A").length, b: shown.filter((p) => p.best === "B").length };
}

const ScoreSide: React.FC<{ label: string; option: string; count: number; color: string }> = ({ label, option, count, color }) => (
  <div style={{ width: 460, padding: "30px 20px", borderRadius: 30, background: C.card, border: `4px solid ${color}`, boxShadow: `0 0 50px ${color}44` }}>
    <div style={{ ...textBase, fontSize: 36, color: C.dim }}>{label}</div>
    <div style={{ ...textBase, fontSize: 150, fontWeight: 900, color, lineHeight: 1.1 }}>{count}</div>
    <div style={{ ...textBase, fontSize: 34, fontWeight: 700 }}>{option}</div>
  </div>
);

// Face-down "?" card until its month is reached, then it pops to the side the engine leans.
const MonthCard: React.FC<{ point: Point; index: number }> = ({ point, index }) => {
  const flip = useEnter(RACE_START + index * MONTH_STEP, 11);
  const shown = flip > 0.02;
  const color = LEAN_COLOR[point.best];
  return (
    <div style={{ width: 300, height: 180, borderRadius: 26, border: `4px solid ${shown ? color : C.border}`, background: shown ? `${color}26` : C.card, boxShadow: shown && point.best !== "EQUAL" ? `0 0 40px ${color}55` : "none", transform: `scale(${shown ? 0.8 + flip * 0.2 : 0.94})`, display: "flex", flexDirection: "column", justifyContent: "center" }}>
      <div style={{ ...textBase, fontSize: 38, fontWeight: 700, color: shown ? C.text : C.dim }}>{point.label}</div>
      <div style={{ ...textBase, fontSize: 62, fontWeight: 900, color: shown ? color : C.dim }}>{shown ? `${point.best === "EQUAL" ? "–" : point.best} · ${point.action}` : "?"}</div>
    </div>
  );
};

const RaceScene: React.FC<PromoProps & { len: number }> = ({ lang, variant, snapshot, len }) => {
  const frame = useCurrentFrame();
  const ui = UI_COPY[lang].race;
  const topic = TOPIC_COPY[lang][variant.topic];
  const revealed = Math.max(0, Math.min(12, Math.floor((frame - RACE_START) / MONTH_STEP) + 1));
  const { a, b } = tally(snapshot.scenario.timeline, revealed);
  return (
    <AbsoluteFill style={{ opacity: useExit(len) }}>
      <div style={{ position: "absolute", top: 230, width: "100%", display: "flex", justifyContent: "center", gap: 40 }}>
        <ScoreSide label={ui.leanA} option={`A · ${topic.forkA}`} count={a} color={LEAN_COLOR.A} />
        <ScoreSide label={ui.leanB} option={`B · ${topic.forkB}`} count={b} color={LEAN_COLOR.B} />
      </div>
      <div style={{ position: "absolute", top: 700, left: 45, width: 990, display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 18 }}>
        {snapshot.scenario.timeline.map((point, index) => <MonthCard key={point.label} point={point} index={index} />)}
      </div>
      <SampleNote lang={lang} top={1530} />
    </AbsoluteFill>
  );
};

const VerdictScene: React.FC<PromoProps & { len: number }> = ({ lang, snapshot, len }) => {
  const ui = UI_COPY[lang].race;
  const peak = useEnter(0, 11);
  const ask = useEnter(36, 12);
  const { timeline } = snapshot.scenario;
  const { strongest, weakest } = timelineExtremes(timeline);
  const top = timeline[strongest];
  const bottom = timeline[weakest];
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", padding: 70, opacity: useExit(len) }}>
      <div style={{ ...textBase, fontSize: 40, color: C.gold, opacity: peak }}>{ui.peak}</div>
      <div style={{ ...textBase, fontSize: 110, fontWeight: 900, color: C.goldHi, transform: `scale(${0.6 + peak * 0.4})` }}>{top?.label} · {top?.action}</div>
      <div style={{ ...textBase, fontSize: 36, color: "#fda4af", marginTop: 16, opacity: peak }}>{ui.low}: {bottom?.label} · {bottom?.action}</div>
      <div style={{ ...textBase, fontSize: 44, fontWeight: 800, marginTop: 40, lineHeight: 1.3, opacity: peak }}>{snapshot.scenario.headline}</div>
      <div style={{ ...textBase, fontSize: 60, fontWeight: 900, marginTop: 80, opacity: ask, transform: `translateY(${(1 - ask) * 40}px)` }}>{ui.ask}</div>
      <SampleNote lang={lang} top={1700} />
    </AbsoluteFill>
  );
};

export const PromoRace: React.FC<PromoProps> = (props) => (
  <AbsoluteFill style={{ backgroundColor: C.bg }}>
    <Backdrop />
    <Shot from={0} durationInFrames={70} name="hook"><HookScene lines={hookLines(props.variant)} len={70} /></Shot>
    <Shot from={70} durationInFrames={60} name="question">
      <QuestionScene label={UI_COPY[props.lang].questionLabel} question={TOPIC_COPY[props.lang][props.variant.topic].question} persona={personaLine(props.lang, props.variant.persona)} len={60} />
    </Shot>
    <Shot from={130} durationInFrames={300} name="race"><RaceScene {...props} len={300} /></Shot>
    <Shot from={430} durationInFrames={95} name="verdict"><VerdictScene {...props} len={95} /></Shot>
    <Shot from={525} durationInFrames={75} name="outro"><OutroScene lang={props.lang} match={false} /></Shot>
  </AbsoluteFill>
);
