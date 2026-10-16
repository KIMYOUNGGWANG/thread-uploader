// PromoKit.tsx — shared palette + motion primitives for the PromoViral video.
// Palette mirrors cosmicpath DESIGN.md (obsidian + champagne gold).
import React from "react";
import { AbsoluteFill, interpolate, random, spring, useCurrentFrame, useVideoConfig } from "remotion";
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
  dim: "rgba(245, 241, 232, 0.55)",
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

export const Starfield: React.FC = () => {
  const frame = useCurrentFrame();
  const stars = Array.from({ length: 70 }, (_, i) => i);
  return (
    <AbsoluteFill>
      {stars.map((i) => {
        const x = random(`x${i}`) * 1080;
        const y = (random(`y${i}`) * 1920 - frame * (0.3 + random(`s${i}`) * 0.8) + 1920) % 1920;
        const twinkle = 0.25 + 0.6 * Math.abs(Math.sin(frame / 18 + i));
        const size = 2 + random(`r${i}`) * 3;
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
              background: i % 7 === 0 ? C.goldHi : "#fff",
              opacity: twinkle,
            }}
          />
        );
      })}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "radial-gradient(ellipse at 50% 40%, rgba(200,168,77,0.12), transparent 60%)",
        }}
      />
    </AbsoluteFill>
  );
};
