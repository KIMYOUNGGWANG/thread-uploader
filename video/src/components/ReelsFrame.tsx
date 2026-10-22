// ReelsFrame.tsx — ig_rank_10s / ig_pickcard_16s가 공유하는 틀.
// 배경 성운 영상(10초 핑퐁 루프) + 글자 대비용 그라데이션 + 하단 브랜드 마크·서브 카피.
// 에셋은 public/reels/ (README 참고). 없으면 단색 배경으로 떨어져 렌더는 계속된다.
import React from "react";
import { AbsoluteFill, Loop, OffthreadVideo, staticFile, useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { FONT_STACK } from "../load-fonts";

export const REELS_BG = "reels/bg-cosmic.mp4";
export const REELS_BGM = "reels/bgm-ambient.m4a";
const BG_LOOP_SECONDS = 10;
const BRAND = "CosmicPath";
const DEFAULT_SUB_COPY = "내 일간 모르면 → 프로필 링크, 1분이면 나와";

// 갑을=목 병정=화 무기=토 경신=금 임계=수. 일간 첫 글자로 색을 고른다.
const ELEMENT_COLORS: Record<string, string> = {
  갑: "#4ade80", 을: "#4ade80",
  병: "#fb7185", 정: "#fb7185",
  무: "#fbbf24", 기: "#fbbf24",
  경: "#e2e8f0", 신: "#e2e8f0",
  임: "#60a5fa", 계: "#60a5fa",
};
export const elementColor = (text: string, fallback: string): string => ELEMENT_COLORS[text.trim().charAt(0)] ?? fallback;

export const ReelsFrame: React.FC<{ subCopy?: string; children: React.ReactNode }> = ({ subCopy = DEFAULT_SUB_COPY, children }) => {
  const { fps } = useVideoConfig();
  const frame = useCurrentFrame();
  const footerOpacity = interpolate(frame, [Math.round(0.8 * fps), Math.round(1.6 * fps)], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ backgroundColor: "#0b0d14", fontFamily: FONT_STACK }}>
      <Loop durationInFrames={BG_LOOP_SECONDS * fps}>
        <OffthreadVideo src={staticFile(REELS_BG)} muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </Loop>
      {/* 위·아래를 어둡게 눌러 글자 대비 확보 */}
      <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(5,7,14,0.55) 0%, rgba(5,7,14,0.18) 45%, rgba(5,7,14,0.35) 75%, rgba(5,7,14,0.85) 100%)" }} />
      {children}
      <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "flex-start", padding: "0 170px 400px 70px", boxSizing: "border-box", pointerEvents: "none" }}>
        <div style={{ opacity: footerOpacity, display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ fontSize: 34, fontWeight: 600, color: "rgba(248,250,252,0.82)", lineHeight: 1.35, wordBreak: "keep-all" }}>{subCopy}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 18, height: 18, borderRadius: 9, background: "linear-gradient(135deg, #fde68a, #a78bfa)", boxShadow: "0 0 18px rgba(167,139,250,0.8)" }} />
            <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: 2, color: "#fde68a" }}>{BRAND}</div>
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
