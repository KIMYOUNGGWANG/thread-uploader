// ReelsFrame.tsx — ig_rank_10s / ig_pickcard_16s가 공유하는 틀.
// 배경(backdrop 촬영본·이미지가 있으면 그것, 없으면 성운 10초 핑퐁 루프) + 글자 대비용 그라데이션 + 하단 브랜드.
// 하단은 첫 프레임부터 보인다: 정지 랭킹은 반복 재생되므로 마지막 프레임 = 첫 프레임이어야 한다.
import React from "react";
import { AbsoluteFill, Img, Loop, OffthreadVideo, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { FONT_STACK } from "../load-fonts";

export const REELS_BG = "reels/bg-cosmic.mp4";
export const REELS_BGM = "reels/bgm-ambient.m4a";
const BG_LOOP_SECONDS = 10;
const BRAND = "CosmicPath";
const DEFAULT_SUB_COPY = "내 일간 모르면 → 프로필 링크, 1분이면 나와";


interface ReelsFrameProps {
  backdrop?: { type: "video" | "image"; src: string }; // public/ 기준. 있으면 성운 배경 대신 쓴다(촬영본·테이블 이미지).
  subCopy?: string; // 빈 문자열이면 브랜드 마크만
  children: React.ReactNode;
}

export const ReelsFrame: React.FC<ReelsFrameProps> = ({ backdrop, subCopy = DEFAULT_SUB_COPY, children }) => {
  const { fps, durationInFrames } = useVideoConfig();
  const frame = useCurrentFrame();
  // 정지 이미지 배경은 아주 느리게 확대해 화면이 멈춰 보이지 않게 한다
  const zoom = interpolate(frame, [0, durationInFrames], [1, 1.06]);

  return (
    <AbsoluteFill style={{ backgroundColor: "#0b0d14", fontFamily: FONT_STACK }}>
      {backdrop?.type === "video" ? (
        <OffthreadVideo src={staticFile(backdrop.src)} muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      ) : backdrop?.type === "image" ? (
        <Img src={staticFile(backdrop.src)} style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${zoom})` }} />
      ) : (
        <Loop durationInFrames={BG_LOOP_SECONDS * fps}>
          <OffthreadVideo src={staticFile(REELS_BG)} muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </Loop>
      )}
      {/* 위·아래를 어둡게 눌러 글자 대비 확보 */}
      <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(5,7,14,0.55) 0%, rgba(5,7,14,0.18) 45%, rgba(5,7,14,0.35) 75%, rgba(5,7,14,0.85) 100%)" }} />
      {children}
      <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "flex-start", padding: "0 170px 400px 70px", boxSizing: "border-box", pointerEvents: "none" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {subCopy ? <div style={{ fontSize: 34, fontWeight: 600, color: "rgba(248,250,252,0.82)", lineHeight: 1.35, wordBreak: "keep-all" }}>{subCopy}</div> : null}
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 18, height: 18, borderRadius: 9, background: "linear-gradient(135deg, #fde68a, #a78bfa)", boxShadow: "0 0 18px rgba(167,139,250,0.8)" }} />
            <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: 2, color: "#fde68a" }}>{BRAND}</div>
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
