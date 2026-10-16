// PromoKit.tsx — shared palette + motion primitives for the PromoViral video.
// Palette mirrors cosmicpath DESIGN.md (obsidian + champagne gold).
import React from "react";
import { AbsoluteFill, Sequence, interpolate, random, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { FONT_STACK } from "../load-fonts";

export type { PromoLang } from "../promo/types.ts";

export const C = {
  bg: "#0a0908",
  card: "rgba(24, 21, 17, 0.92)",
  border: "rgba(255, 255, 255, 0.10)",
  gold: "#c8a84d",
  goldHi: "#f5d77f",
  emerald: "#34d399",
  rose: "#f43f5e",
  indigo: "#818cf8",
  text: "#f5f1e8",
  dim: "rgba(245, 241, 232, 0.72)",
};

export function useEnter(delay = 0, damping = 14): number {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - delay, fps, config: { damping, mass: 0.8 } });
}

export function useExit(len: number, outFrames = 10): number {
  const frame = useCurrentFrame();
  return interpolate(frame, [len - outFrames, len], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
}

export const textBase: React.CSSProperties = {
  fontFamily: FONT_STACK,
  color: C.text,
  textAlign: "center",
  wordBreak: "keep-all",
  letterSpacing: "-0.02em",
};

export const Rise: React.FC<{ delay?: number; children: React.ReactNode; style?: React.CSSProperties }> = ({
  delay = 0,
  children,
  style,
}) => {
  const p = useEnter(delay);
  return (
    <div style={{ opacity: p, transform: `translateY(${(1 - p) * 60}px)`, ...style }}>{children}</div>
  );
};

// Drifting stars + a slow gold glow + a top progress bar, so no frame reads as a dead black slide.
export const Backdrop: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const stars = Array.from({ length: 90 }, (_, i) => i);
  const glowX = 50 + Math.sin(frame / 80) * 14;
  const glowY = 38 + Math.cos(frame / 110) * 8;
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse at ${glowX}% ${glowY}%, rgba(200,168,77,0.24), transparent 58%)` }} />
      <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse at ${100 - glowX}% 82%, rgba(245,215,127,0.10), transparent 50%)` }} />
      {stars.map((i) => {
        const x = random(`x${i}`) * 1080;
        const y = (random(`y${i}`) * 1920 - frame * (0.6 + random(`s${i}`) * 1.4) + 1920) % 1920;
        const twinkle = 0.3 + 0.7 * Math.abs(Math.sin(frame / 18 + i));
        const size = 2 + random(`r${i}`) * 4;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x,
              top: y,
              width: size,
              height: size,
              borderRadius: size,
              background: i % 5 === 0 ? C.goldHi : "#fff",
              opacity: twinkle,
            }}
          />
        );
      })}
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 50% 50%, transparent 55%, rgba(0,0,0,0.55) 100%)" }} />
      <div style={{ position: "absolute", top: 0, left: 0, height: 10, width: `${(frame / durationInFrames) * 100}%`, background: `linear-gradient(90deg, ${C.gold}, ${C.goldHi})`, boxShadow: `0 0 24px ${C.goldHi}` }} />
    </AbsoluteFill>
  );
};

// Sequence with a slow camera push-in, so every scene keeps moving after its elements land.
export const Shot: React.FC<{ from: number; durationInFrames: number; name: string; children: React.ReactNode }> = ({
  from,
  durationInFrames,
  name,
  children,
}) => (
  <Sequence from={from} durationInFrames={durationInFrames} name={name}>
    <Camera len={durationInFrames}>{children}</Camera>
  </Sequence>
);

const Camera: React.FC<{ len: number; children: React.ReactNode }> = ({ len, children }) => {
  const frame = useCurrentFrame();
  const push = interpolate(frame, [0, len], [1, 1.045], { extrapolateRight: "clamp" });
  return <AbsoluteFill style={{ transform: `scale(${push})` }}>{children}</AbsoluteFill>;
};
