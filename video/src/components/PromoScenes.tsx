// PromoScenes.tsx — scenes shared by every promo format: hook, one question, outro/CTA.
import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { C, Rise, textBase, useEnter, useExit } from "./PromoKit";
import { UI_COPY } from "../promo/copy.ts";
import type { PromoLang } from "../promo/types.ts";

export const HookScene: React.FC<{ lines: readonly string[]; len: number }> = ({ lines, len }) => {
  const frame = useCurrentFrame();
  const punchAt = 14 + (lines.length - 1) * 14;
  const punch = useEnter(punchAt, 9);
  const shake = frame > punchAt && frame < punchAt + 12 ? Math.sin(frame * 3) * 8 : 0;
  const lead = lines.slice(0, -1);
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", padding: 80, opacity: useExit(len) }}>
      {lead.map((line, index) => (
        <Rise key={index} delay={index * 10} style={{ marginTop: index === 0 ? 0 : 28 }}>
          <div style={{ ...textBase, fontSize: index === 0 ? 52 : 72, fontWeight: index === 0 ? 600 : 800, color: index === 0 ? C.dim : C.text }}>{line}</div>
        </Rise>
      ))}
      <div style={{ ...textBase, marginTop: 80, fontSize: 86, fontWeight: 900, color: C.goldHi, opacity: punch, transform: `scale(${0.6 + punch * 0.4}) translateX(${shake}px)` }}>
        {lines[lines.length - 1]}
      </div>
    </AbsoluteFill>
  );
};

export const QuestionScene: React.FC<{ label: string; question: string; persona: string; len: number }> = ({ label, question, persona, len }) => {
  const frame = useCurrentFrame();
  const chars = Math.floor(interpolate(frame, [10, 40], [0, question.length], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));
  const caret = Math.floor(frame / 8) % 2 === 0 ? 1 : 0;
  return (
    <AbsoluteFill style={{ justifyContent: "center", padding: 80, opacity: useExit(len, 8) }}>
      <Rise><div style={{ ...textBase, fontSize: 48, color: C.dim, fontWeight: 600, marginBottom: 40 }}>{label}</div></Rise>
      <Rise delay={4}>
        <div style={{ padding: "48px 40px", borderRadius: 36, background: C.card, border: `3px solid ${C.gold}`, boxShadow: `0 0 80px ${C.gold}33` }}>
          <div style={{ ...textBase, fontSize: 72, fontWeight: 800, minHeight: 100 }}>
            {question.slice(0, chars)}<span style={{ opacity: caret, color: C.goldHi }}>|</span>
          </div>
        </div>
      </Rise>
      <Rise delay={28} style={{ marginTop: 36 }}><div style={{ ...textBase, fontSize: 34, color: C.dim }}>{persona}</div></Rise>
    </AbsoluteFill>
  );
};

export const SampleNote: React.FC<{ lang: PromoLang; top: number }> = ({ lang, top }) => (
  <div style={{ position: "absolute", top, width: "100%", ...textBase, fontSize: 28, color: C.dim }}>{UI_COPY[lang].sampleNote}</div>
);

export const OutroScene: React.FC<{ lang: PromoLang; match: boolean }> = ({ lang, match }) => {
  const ui = UI_COPY[lang];
  const cta = useEnter(30, 12);
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", padding: 70 }}>
      <Rise><div style={{ ...textBase, fontSize: 60, fontWeight: 700, color: C.dim }}>{ui.outro[0]}</div></Rise>
      <Rise delay={10} style={{ marginTop: 20 }}><div style={{ ...textBase, fontSize: 80, fontWeight: 900, color: C.goldHi }}>{ui.outro[1]}</div></Rise>
      <div style={{ marginTop: 100, opacity: cta, transform: `translateY(${(1 - cta) * 40}px)`, display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div style={{ ...textBase, fontSize: 46, fontWeight: 800, color: C.bg, background: C.goldHi, padding: "26px 56px", borderRadius: 999 }}>{match ? ui.ctaMatch : ui.cta}</div>
        {match ? null : <div style={{ ...textBase, fontSize: 36, marginTop: 30 }}>{ui.price}</div>}
        <div style={{ ...textBase, fontSize: 58, fontWeight: 900, marginTop: 50, letterSpacing: "0.02em" }}>cosmicpath.app</div>
      </div>
      <div style={{ position: "absolute", bottom: 120, ...textBase, fontSize: 26, color: C.dim, opacity: cta, padding: "0 80px" }}>{ui.disclaimer}</div>
    </AbsoluteFill>
  );
};
