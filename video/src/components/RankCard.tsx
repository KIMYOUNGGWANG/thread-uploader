// RankCard.tsx — ig_rank_10s: 랭킹 정지 이미지. 제목 + 순위 5개가 첫 프레임부터 전부 보인다.
// 레퍼런스(zendi_tarot 4~6초 정지)처럼 짧게 반복 재생되게 하려고 등장 애니메이션이 없다.
// 해석은 캡션이 맡고, 화면은 "멈춰서 내 일간 찾기"만 하게 한다.
import React from "react";
import { AbsoluteFill } from "remotion";
import { FONT_STACK } from "../load-fonts";
import { elementColor } from "./ReelsFrame";

export interface RankCardProps {
  title: string;
  items: string[];
}

const RANK_COLORS = ["#facc15", "#e2e8f0", "#f59e0b", "#94a3b8", "#94a3b8"];

const RankRow: React.FC<{ rank: number; text: string }> = ({ rank, text }) => {
  // 일간 오행 색이 우선, 일간이 아니면 순위 색
  const color = elementColor(text, RANK_COLORS[rank - 1] ?? "#94a3b8");
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 28,
        padding: "26px 32px",
        borderRadius: 24,
        background: "rgba(11,13,20,0.55)",
        backdropFilter: "blur(6px)",
        border: `2px solid ${rank === 1 ? color : `${color}66`}`,
        boxShadow: rank === 1 ? `0 0 28px ${color}55` : "none",
      }}
    >
      <div style={{ width: 84, fontSize: 64, fontWeight: 900, color, textAlign: "center", flexShrink: 0 }}>{rank}</div>
      <div style={{ fontSize: 44, fontWeight: 700, color: "#f8fafc", lineHeight: 1.3, wordBreak: "keep-all" }}>{text}</div>
    </div>
  );
};

export const RankCard: React.FC<RankCardProps> = ({ title, items }) => (
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
        textShadow: "0 4px 24px rgba(0,0,0,0.8)",
      }}
    >
      {title}
      <div style={{ width: 96, height: 6, borderRadius: 3, marginTop: 18, background: "linear-gradient(90deg, #fde68a, #a78bfa)" }} />
    </div>
    {items.map((text, index) => (
      <RankRow key={`${index}-${text}`} rank={index + 1} text={text} />
    ))}
  </AbsoluteFill>
);
