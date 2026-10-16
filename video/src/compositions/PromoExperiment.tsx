// PromoExperiment.tsx — format ④: a 7-day experiment checklist (20s), built to be saved.
// Only the "when" window and strongest day are engine values; the steps are labelled as a sample screen.
import React from "react";
import { AbsoluteFill } from "remotion";
import { ensurePretendard } from "../load-fonts";
import { C, Shot, Backdrop, textBase, useEnter, useExit } from "../components/PromoKit";
import { HookScene, OutroScene, QuestionScene, SampleNote } from "../components/PromoScenes";
import { TOPIC_COPY, UI_COPY, hookLines, personaLine } from "../promo/copy.ts";
import type { PromoProps } from "../promo/types.ts";

void ensurePretendard();

const CHECK_START = 30;
const CHECK_STEP = 55;

const CheckItem: React.FC<{ text: string; index: number }> = ({ text, index }) => {
  const enter = useEnter(index * 8, 13);
  const check = useEnter(CHECK_START + index * CHECK_STEP, 10);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 26, marginTop: 30, padding: "34px 34px", borderRadius: 26, background: C.card, border: `2px solid ${check > 0.5 ? C.emerald : C.border}`, opacity: enter }}>
      <div style={{ width: 54, height: 54, borderRadius: 14, border: `4px solid ${C.emerald}`, display: "flex", justifyContent: "center", alignItems: "center" }}>
        <div style={{ width: 26, height: 14, borderLeft: `6px solid ${C.emerald}`, borderBottom: `6px solid ${C.emerald}`, transform: `rotate(-45deg) scale(${check})`, marginTop: -6 }} />
      </div>
      <div style={{ ...textBase, textAlign: "left", fontSize: 44, fontWeight: 700, opacity: 0.6 + check * 0.4 }}>{text}</div>
    </div>
  );
};

const StopBanner: React.FC<{ title: string; rule: string; ifThen: readonly [string, string] }> = ({ title, rule, ifThen }) => {
  const enter = useEnter(CHECK_START + CHECK_STEP * 2 - 15, 11);
  return (
    <div style={{ marginTop: 34, padding: "28px 32px", borderRadius: 24, border: `4px solid ${C.rose}`, background: "rgba(244,63,94,0.12)", opacity: enter, transform: `translateX(${(1 - enter) * 600}px)` }}>
      <div style={{ ...textBase, textAlign: "left", fontSize: 44, fontWeight: 900, color: "#fda4af" }}>{title}: {rule}</div>
      <div style={{ ...textBase, textAlign: "left", fontSize: 36, color: C.dim, marginTop: 14, whiteSpace: "pre-line" }}>{ifThen.join("\n")}</div>
    </div>
  );
};

const ChecklistScene: React.FC<PromoProps & { len: number }> = ({ lang, variant, snapshot, len }) => {
  const ui = UI_COPY[lang].experiment;
  const topic = TOPIC_COPY[lang][variant.topic];
  const best = snapshot.heatmap.bestDay;
  return (
    <AbsoluteFill style={{ padding: "250px 70px", opacity: useExit(len) }}>
      <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
        <span style={{ ...textBase, fontSize: 28, fontWeight: 700, color: C.bg, background: C.goldHi, padding: "8px 20px", borderRadius: 999 }}>{ui.sample}</span>
        <span style={{ ...textBase, fontSize: 34, color: C.gold }}>{ui.when}: {snapshot.scenario.peakLabel}</span>
      </div>
      <div style={{ ...textBase, textAlign: "left", fontSize: 34, color: C.dim, marginTop: 14 }}>{ui.bestDay}: {best ? `${best.date} · ${best.score}` : "-"}</div>
      <div style={{ ...textBase, textAlign: "left", fontSize: 66, fontWeight: 900, marginTop: 34 }}>{topic.question}</div>
      <CheckItem text={topic.experiment[0]} index={0} />
      <CheckItem text={topic.experiment[1]} index={1} />
      <StopBanner title={ui.stopTitle} rule={topic.stopRule} ifThen={topic.ifThen} />
      <CheckItem text={topic.experiment[2]} index={2} />
      <CheckItem text={topic.experiment[3]} index={3} />
      <SampleNote lang={lang} top={1780} />
    </AbsoluteFill>
  );
};

const SaveScene: React.FC<{ text: string; len: number }> = ({ text, len }) => {
  const pop = useEnter(0, 10);
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", padding: 80, opacity: useExit(len) }}>
      <div style={{ ...textBase, fontSize: 84, fontWeight: 900, color: C.goldHi, transform: `scale(${0.6 + pop * 0.4})` }}>{text}</div>
    </AbsoluteFill>
  );
};

export const PromoExperiment: React.FC<PromoProps> = (props) => (
  <AbsoluteFill style={{ backgroundColor: C.bg }}>
    <Backdrop />
    <Shot from={0} durationInFrames={70} name="hook"><HookScene lines={hookLines(props.variant)} len={70} /></Shot>
    <Shot from={70} durationInFrames={50} name="question">
      <QuestionScene label={UI_COPY[props.lang].questionLabel} question={TOPIC_COPY[props.lang][props.variant.topic].question} persona={personaLine(props.lang, props.variant.persona)} len={50} />
    </Shot>
    <Shot from={120} durationInFrames={300} name="checklist"><ChecklistScene {...props} len={300} /></Shot>
    <Shot from={420} durationInFrames={90} name="save"><SaveScene text={UI_COPY[props.lang].experiment.save} len={90} /></Shot>
    <Shot from={510} durationInFrames={90} name="outro"><OutroScene lang={props.lang} match={false} /></Shot>
  </AbsoluteFill>
);
