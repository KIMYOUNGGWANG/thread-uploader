// PromoMatch.tsx — format ③ (Korean only): two fictional birthdays through the real /match calculator.
// Scores, elements, signs and 천간합/지지충 come from match-calculator.calculateCompatibility.
import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { ensurePretendard } from "../load-fonts";
import { C, Shot, Backdrop, textBase, useEnter, useExit } from "../components/PromoKit";
import { HookScene, OutroScene, SampleNote } from "../components/PromoScenes";
import { UI_COPY, hookLines } from "../promo/copy.ts";
import type { Persona, PromoLang, PromoProps } from "../promo/types.ts";

void ensurePretendard();

type Match = NonNullable<PromoProps["snapshot"]["match"]>;

const BirthCard: React.FC<{ persona: Persona; dayMaster: string; element: string; sign: string; side: -1 | 1 }> = ({ persona, dayMaster, element, sign, side }) => {
  const enter = useEnter(side === -1 ? 0 : 8, 12);
  return (
    <div style={{ width: 430, padding: "40px 24px", borderRadius: 32, background: C.card, border: `3px solid ${side === -1 ? C.gold : C.indigo}`, opacity: enter, transform: `translateX(${side * (1 - enter) * 500}px)` }}>
      <div style={{ ...textBase, fontSize: 34, color: C.dim }}>{persona.birthDate.replaceAll("-", ". ")}</div>
      <div style={{ ...textBase, fontSize: 64, fontWeight: 900, marginTop: 12 }}>{dayMaster} · {element}</div>
      <div style={{ ...textBase, fontSize: 32, color: C.dim, marginTop: 12 }}>{sign}</div>
    </div>
  );
};

const ScoreBar: React.FC<{ label: string; value: number; delay: number }> = ({ label, value, delay }) => {
  const frame = useCurrentFrame();
  const grow = interpolate(frame, [delay, delay + 30], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 24, marginTop: 30 }}>
      <div style={{ ...textBase, width: 180, textAlign: "right", fontSize: 38, fontWeight: 700 }}>{label}</div>
      <div style={{ width: 560, height: 44, borderRadius: 22, background: "rgba(255,255,255,0.06)" }}>
        <div style={{ width: `${value * grow}%`, height: "100%", borderRadius: 22, background: C.gold }} />
      </div>
      <div style={{ ...textBase, width: 100, fontSize: 44, fontWeight: 900, color: C.goldHi, opacity: grow }}>{Math.round(value * grow)}</div>
    </div>
  );
};

const Badge: React.FC<{ label: string; on: boolean; lang: PromoLang; delay: number }> = ({ label, on, lang, delay }) => {
  const enter = useEnter(delay, 12);
  const ui = UI_COPY[lang].match;
  return (
    <div style={{ ...textBase, fontSize: 38, fontWeight: 800, padding: "18px 36px", borderRadius: 999, border: `3px solid ${on ? C.emerald : C.border}`, color: on ? C.emerald : C.dim, opacity: enter }}>
      {label} {on ? ui.yes : ui.no}
    </div>
  );
};

const MatchScene: React.FC<{ lang: PromoLang; match: Match; host: Persona; guest: Persona; len: number }> = ({ lang, match, host, guest, len }) => {
  const ui = UI_COPY[lang].match;
  const overall = useEnter(200, 11);
  const ask = useEnter(285, 12);
  return (
    <AbsoluteFill style={{ opacity: useExit(len) }}>
      <div style={{ position: "absolute", top: 110, width: "100%", ...textBase, fontSize: 40, fontWeight: 800, color: C.gold }}>{ui.title}</div>
      <SampleNote lang={lang} top={170} />
      <div style={{ position: "absolute", top: 260, width: "100%", display: "flex", justifyContent: "center", gap: 40 }}>
        <BirthCard persona={host} dayMaster={match.hostDayMaster} element={match.hostElement} sign={match.hostSign} side={-1} />
        <BirthCard persona={guest} dayMaster={match.guestDayMaster} element={match.guestElement} sign={match.guestSign} side={1} />
      </div>
      <div style={{ position: "absolute", top: 640, width: "100%", display: "flex", flexDirection: "column", alignItems: "center" }}>
        <ScoreBar label={ui.saju} value={match.saju} delay={60} />
        <ScoreBar label={ui.astro} value={match.astro} delay={100} />
        <ScoreBar label={ui.num} value={match.num} delay={140} />
      </div>
      <div style={{ position: "absolute", top: 1010, width: "100%", opacity: overall, transform: `scale(${0.6 + overall * 0.4})` }}>
        <div style={{ ...textBase, fontSize: 40, color: C.dim }}>{ui.overall}</div>
        <div style={{ ...textBase, fontSize: 160, fontWeight: 900, color: C.goldHi }}>{match.overall}</div>
      </div>
      <div style={{ position: "absolute", top: 1330, width: "100%", display: "flex", justifyContent: "center", gap: 30 }}>
        <Badge label={ui.combine} on={match.tianganHe} lang={lang} delay={250} />
        <Badge label={ui.clash} on={match.dizhiChong} lang={lang} delay={262} />
      </div>
      <div style={{ position: "absolute", top: 1520, width: "100%", ...textBase, fontSize: 56, fontWeight: 900, opacity: ask }}>{ui.ask}</div>
    </AbsoluteFill>
  );
};

export const PromoMatch: React.FC<PromoProps> = ({ lang, variant, snapshot }) => {
  const { match, guest } = snapshot;
  if (!match || !guest) {
    return <AbsoluteFill style={{ backgroundColor: C.bg, justifyContent: "center", ...textBase, fontSize: 40 }}>match snapshot missing</AbsoluteFill>;
  }
  return (
    <AbsoluteFill style={{ backgroundColor: C.bg }}>
      <Backdrop />
      <Shot from={0} durationInFrames={70} name="hook"><HookScene lines={hookLines(variant)} len={70} /></Shot>
      <Shot from={70} durationInFrames={360} name="match"><MatchScene lang={lang} match={match} host={snapshot.persona} guest={guest} len={360} /></Shot>
      <Shot from={430} durationInFrames={170} name="outro"><OutroScene lang={lang} match /></Shot>
    </AbsoluteFill>
  );
};
