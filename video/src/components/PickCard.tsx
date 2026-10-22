// PickCard.tsx — ig_pickcard_16s: 질문 1줄 + 카드 A/B/C가 4초쯤 등장, ctaAtSeconds 지점에 선택형 CTA.
// CTA는 "저장하고 A/B/C 골라 댓글" 류 선택형만. 키워드 DM·"댓글 달면 해석"은 쓰지 않는다.
import React from "react";
import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { FONT_STACK } from "../load-fonts";

export interface PickCardOption {
  label: string;
  text: string;
}

export interface PickCardProps {
  question: string;
  cards: PickCardOption[];
  cta: string;
  ctaAtSeconds: number;
}

const CARDS_AT_SECONDS = 4;
const CARD_STAGGER_SECONDS = 0.35;
const LABEL_GRADIENTS = [
  "linear-gradient(135deg, #f9a8d4, #a855f7)",
  "linear-gradient(135deg, #fde68a, #f59e0b)",
  "linear-gradient(135deg, #99f6e4, #0ea5e9)",
];

function useEnter(startFrame: number): { opacity: number; scale: number } {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const progress = spring({ frame: frame - startFrame, fps, config: { damping: 12, stiffness: 140 } });
  const visible = frame >= startFrame;
  return { opacity: visible ? progress : 0, scale: visible ? 0.85 + progress * 0.15 : 0.85 };
}

const OptionCard: React.FC<{ option: PickCardOption; index: number; startFrame: number }> = ({ option, index, startFrame }) => {
  const enter = useEnter(startFrame);
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 32,
        padding: "34px 36px",
        borderRadius: 28,
        background: "rgba(11,13,20,0.55)",
        backdropFilter: "blur(6px)",
        border: "2px solid rgba(255,255,255,0.22)",
        opacity: enter.opacity,
        transform: `scale(${enter.scale})`,
      }}
    >
      <div
        style={{
          width: 110,
          height: 110,
          borderRadius: 28,
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 60,
          fontWeight: 900,
          color: "#0b0d14",
          background: LABEL_GRADIENTS[index] ?? LABEL_GRADIENTS[0],
        }}
      >
        {option.label}
      </div>
      <div style={{ fontSize: 42, fontWeight: 700, color: "#f8fafc", lineHeight: 1.3, wordBreak: "keep-all" }}>{option.text}</div>
    </div>
  );
};

export const PickCard: React.FC<PickCardProps> = ({ question, cards, cta, ctaAtSeconds }) => {
  const { fps } = useVideoConfig();
  const questionEnter = useEnter(0);
  const ctaEnter = useEnter(Math.round(ctaAtSeconds * fps));

  return (
    <AbsoluteFill
      style={{
        fontFamily: FONT_STACK,
        padding: "180px 170px 380px 70px",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          fontSize: 64,
          fontWeight: 900,
          color: "#ffffff",
          lineHeight: 1.25,
          letterSpacing: -1,
          wordBreak: "keep-all",
          textShadow: "0 4px 24px rgba(0,0,0,0.8)",
          opacity: questionEnter.opacity,
          transform: `scale(${questionEnter.scale})`,
          transformOrigin: "left top",
        }}
      >
        {question}
        <div style={{ width: 96, height: 6, borderRadius: 3, marginTop: 18, background: "linear-gradient(90deg, #fde68a, #a78bfa)" }} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 30, marginTop: 70 }}>
        {cards.map((option, index) => (
          <OptionCard
            key={option.label}
            option={option}
            index={index}
            startFrame={Math.round((CARDS_AT_SECONDS + index * CARD_STAGGER_SECONDS) * fps)}
          />
        ))}
      </div>
      {/* CTA는 카드 바로 아래. 하단은 ReelsFrame의 브랜드 영역이 쓴다. */}
      <div
        style={{
          marginTop: 56,
          padding: "30px 36px",
          borderRadius: 999,
          background: "#facc15",
          boxShadow: "0 0 32px rgba(250,204,21,0.45)",
          color: "#0b0d14",
          fontSize: 40,
          fontWeight: 900,
          textAlign: "center",
          wordBreak: "keep-all",
          opacity: ctaEnter.opacity,
          transform: `scale(${ctaEnter.scale})`,
        }}
      >
        {cta}
      </div>
    </AbsoluteFill>
  );
};
