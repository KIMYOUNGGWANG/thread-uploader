// RankCard.tsx — ig_rank_10s: 랭킹 정지 이미지. 제목 + 순위 5개가 첫 프레임부터 전부 보인다.
// 레퍼런스(zendi_tarot 4~6초 정지)처럼 짧게 반복 재생되게 하려고 등장 애니메이션이 없다.
// 사주 톤: 나무 탁자 위 한지 한 장(카드 선택과 같은 saju-front.png 재사용)에 먹색 글씨,
// 일간마다 천간 한자를 오행 색으로 붙인다. 해석은 캡션이 맡는다.
import React from "react";
import { AbsoluteFill, Img, staticFile } from "remotion";
import { FONT_STACK, SERIF_STACK } from "../load-fonts";

export interface RankCardProps {
  title: string;
  items: string[];
}

const HANJI = "reels/cards/saju-front.png";
const INK = "#1d1a17";
const PANEL_WIDTH = 840;

// 한지 위에서 읽히도록 어둡게 맞춘 오행 색: 목 청록, 화 적, 토 황, 금 회백, 수 흑
const STEMS: Record<string, { hanja: string; color: string }> = {
  갑: { hanja: "甲", color: "#2f6f5a" }, 을: { hanja: "乙", color: "#2f6f5a" },
  병: { hanja: "丙", color: "#b8322a" }, 정: { hanja: "丁", color: "#b8322a" },
  무: { hanja: "戊", color: "#b7861a" }, 기: { hanja: "己", color: "#b7861a" },
  경: { hanja: "庚", color: "#7d7a74" }, 신: { hanja: "辛", color: "#7d7a74" },
  임: { hanja: "壬", color: INK }, 계: { hanja: "癸", color: INK },
};

const RankRow: React.FC<{ rank: number; text: string }> = ({ rank, text }) => {
  const stem = STEMS[text.trim().charAt(0)];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 22, padding: "24px 0", borderBottom: "1.5px solid rgba(168,50,42,0.28)" }}>
      <div style={{ width: 40, fontFamily: SERIF_STACK, fontSize: 40, color: "#a8322a", textAlign: "center", flexShrink: 0 }}>{rank}</div>
      <div
        style={{
          width: 104,
          height: 104,
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: SERIF_STACK,
          fontSize: 72,
          color: stem?.color ?? INK,
          border: `2.5px solid ${stem?.color ?? INK}`,
          borderRadius: 8,
        }}
      >
        {stem?.hanja ?? rank}
      </div>
      <div style={{ fontFamily: FONT_STACK, fontSize: 40, fontWeight: 700, color: INK, lineHeight: 1.3, wordBreak: "keep-all" }}>{text}</div>
    </div>
  );
};

export const RankCard: React.FC<RankCardProps> = ({ title, items }) => (
  // 한지는 카드 원본 비율(688:1024) 그대로, 하단 "내 일간 모르면" 문구 위에서 끝나게 둔다
  <AbsoluteFill style={{ padding: "140px 0 0 56px", boxSizing: "border-box" }}>
    <div style={{ position: "relative", width: PANEL_WIDTH, height: Math.round(PANEL_WIDTH * (1024 / 688)), borderRadius: 10, boxShadow: "0 30px 70px rgba(0,0,0,0.7)" }}>
      {/* 한지 카드 이미지를 패널 크기로 늘려 종이 질감·붉은 테두리·낙관을 그대로 쓴다 */}
      <Img src={staticFile(HANJI)} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "fill", borderRadius: 10 }} />
      <div style={{ position: "relative", padding: "64px 54px 40px", display: "flex", flexDirection: "column" }}>
        <div style={{ fontFamily: SERIF_STACK, fontSize: 60, color: INK, lineHeight: 1.25, wordBreak: "keep-all", marginBottom: 26 }}>{title}</div>
        <div style={{ height: 3, background: "#a8322a", marginBottom: 10 }} />
        {items.map((text, index) => (
          <RankRow key={`${index}-${text}`} rank={index + 1} text={text} />
        ))}
      </div>
    </div>
  </AbsoluteFill>
);
