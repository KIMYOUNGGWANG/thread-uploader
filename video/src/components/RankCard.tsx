// RankCard.tsx — ig_rank_10s: 제목 1줄 + 순위 5개가 순서대로 나타나는 정지 카드.
// 음악·내레이션 없음. 모든 등장은 프레임 기반이라 렌더가 결정적이다.
import React from "react";
import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { FONT_STACK } from "../load-fonts";

export interface RankCardProps {
  title: string;
  items: string[];
}

const TITLE_AT_SECONDS = 0;
const FIRST_ITEM_AT_SECONDS = 1.4;
const ITEM_GAP_SECONDS = 1.3;
const RANK_COLORS = ["#facc15", "#e2e8f0", "#f59e0b", "#94a3b8", "#94a3b8"];

function useEnter(startFrame: number): { opacity: number; translateY: number } {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const progress = spring({ frame: frame - startFrame, fps, config: { damping: 14, stiffness: 120 } });
  const visible = frame >= startFrame;
  return { opacity: visible ? progress : 0, translateY: visible ? (1 - progress) * 40 : 40 };
}

const RankRow: React.FC<{ rank: number; text: string; startFrame: number }> = ({ rank, text, startFrame }) => {
  const enter = useEnter(startFrame);
  const color = RANK_COLORS[rank - 1] ?? "#94a3b8";
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 28,
        padding: "26px 32px",
        borderRadius: 24,
        background: "rgba(255,255,255,0.06)",
        border: `2px solid ${rank === 1 ? color : "rgba(255,255,255,0.14)"}`,
        opacity: enter.opacity,
        transform: `translateY(${enter.translateY}px)`,
      }}
    >
      <div style={{ width: 84, fontSize: 64, fontWeight: 900, color, textAlign: "center", flexShrink: 0 }}>{rank}</div>
      <div style={{ fontSize: 44, fontWeight: 700, color: "#f8fafc", lineHeight: 1.3, wordBreak: "keep-all" }}>{text}</div>
    </div>
  );
};

export const RankCard: React.FC<RankCardProps> = ({ title, items }) => {
  const { fps } = useVideoConfig();
  const titleEnter = useEnter(Math.round(TITLE_AT_SECONDS * fps));

  return (
    <AbsoluteFill
      style={{
        fontFamily: FONT_STACK,
        // 인스타 릴스 UI(상단 바·우측 아이콘·하단 캡션)를 피하는 여백
        padding: "180px 170px 380px 70px",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        gap: 26,
      }}
    >
      <div
        style={{
          fontSize: 68,
          fontWeight: 900,
          color: "#ffffff",
          lineHeight: 1.2,
          letterSpacing: -1,
          wordBreak: "keep-all",
          marginBottom: 24,
          opacity: titleEnter.opacity,
          transform: `translateY(${titleEnter.translateY}px)`,
        }}
      >
        {title}
      </div>
      {items.map((text, index) => (
        <RankRow
          key={`${index}-${text}`}
          rank={index + 1}
          text={text}
          startFrame={Math.round((FIRST_ITEM_AT_SECONDS + index * ITEM_GAP_SECONDS) * fps)}
        />
      ))}
    </AbsoluteFill>
  );
};
