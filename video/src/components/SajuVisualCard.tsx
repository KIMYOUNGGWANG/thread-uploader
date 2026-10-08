// SajuVisualCard.tsx — Programmatic React/SVG Saju (Four Pillars) visual card.
// Eliminates stock video by rendering deterministic, high-contrast astrological charts.
import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { FONT_STACK } from "../load-fonts";

export interface SajuPillar {
  heavenly: { char: string; element: "wood" | "fire" | "earth" | "metal" | "water"; name: string };
  earthly: { char: string; element: "wood" | "fire" | "earth" | "metal" | "water"; name: string };
  role: "시주 (말년)" | "일주 (본인)" | "월주 (청년)" | "년주 (초년)";
}

export interface SajuCardData {
  title?: string;
  subtitle?: string;
  dayMaster?: string; // 일간
  destinyKeyword?: string;
  elementsRatio?: { wood: number; fire: number; earth: number; metal: number; water: number };
  pillars?: SajuPillar[];
}

interface ElementStyle {
  bg: string;
  border: string;
  text: string;
  glow: string;
}

const DEFAULT_STYLE: ElementStyle = {
  bg: "rgba(241, 245, 249, 0.2)",
  border: "#f1f5f9",
  text: "#ffffff",
  glow: "rgba(255, 255, 255, 0.4)",
};

const ELEMENT_COLORS: Record<string, ElementStyle> = {
  wood: { bg: "rgba(34, 197, 94, 0.15)", border: "#22c55e", text: "#4ade80", glow: "rgba(34, 197, 94, 0.4)" },
  fire: { bg: "rgba(239, 68, 68, 0.15)", border: "#ef4444", text: "#f87171", glow: "rgba(239, 68, 68, 0.4)" },
  earth: { bg: "rgba(234, 179, 8, 0.15)", border: "#eab308", text: "#facc15", glow: "rgba(234, 179, 8, 0.4)" },
  metal: { bg: "rgba(241, 245, 249, 0.2)", border: "#f1f5f9", text: "#ffffff", glow: "rgba(255, 255, 255, 0.4)" },
  water: { bg: "rgba(59, 130, 246, 0.15)", border: "#3b82f6", text: "#60a5fa", glow: "rgba(59, 130, 246, 0.4)" },
};

function getElementStyle(element: string): ElementStyle {
  return ELEMENT_COLORS[element] ?? DEFAULT_STYLE;
}

export const DEFAULT_SAJU_PILLARS: SajuPillar[] = [
  { heavenly: { char: "甲", element: "wood", name: "갑목" }, earthly: { char: "子", element: "water", name: "자수" }, role: "시주 (말년)" },
  { heavenly: { char: "丙", element: "fire", name: "병화" }, earthly: { char: "午", element: "fire", name: "오화" }, role: "일주 (본인)" },
  { heavenly: { char: "戊", element: "earth", name: "무토" }, earthly: { char: "辰", element: "earth", name: "진토" }, role: "월주 (청년)" },
  { heavenly: { char: "庚", element: "metal", name: "경금" }, earthly: { char: "申", element: "metal", name: "신금" }, role: "년주 (초년)" },
];

const HEAVENLY_STEMS: Record<string, SajuPillar["heavenly"]> = {
  갑목: { char: "甲", element: "wood", name: "갑목" },
  을목: { char: "乙", element: "wood", name: "을목" },
  병화: { char: "丙", element: "fire", name: "병화" },
  정화: { char: "丁", element: "fire", name: "정화" },
  무토: { char: "戊", element: "earth", name: "무토" },
  기토: { char: "己", element: "earth", name: "기토" },
  경금: { char: "庚", element: "metal", name: "경금" },
  신금: { char: "辛", element: "metal", name: "신금" },
  임수: { char: "壬", element: "water", name: "임수" },
  계수: { char: "癸", element: "water", name: "계수" },
};

// Without explicit pillars, the day pillar's heavenly stem must still match the requested day master
// (the template chart otherwise showed 丙 for every video).
export function resolvePillars(cardData?: SajuCardData): SajuPillar[] {
  if (cardData?.pillars) return cardData.pillars;
  const dayStem = cardData?.dayMaster ? HEAVENLY_STEMS[cardData.dayMaster.replace(/\s/g, "")] : undefined;
  if (!dayStem) return DEFAULT_SAJU_PILLARS;
  return DEFAULT_SAJU_PILLARS.map((pillar) => (pillar.role === "일주 (본인)" ? { ...pillar, heavenly: dayStem } : pillar));
}

export const SajuVisualCard: React.FC<{ cardData?: SajuCardData }> = ({ cardData }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const title = cardData?.title ?? "2026 하반기 대운 사주 명식";
  const subtitle = cardData?.subtitle ?? "타고난 일주와 숨겨진 귀인 흐름";
  const destinyKeyword = cardData?.destinyKeyword ?? "재물운 급상승 · 역마 귀인";
  const pillars = resolvePillars(cardData);

  // Spring entrance animation
  const cardScale = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 120 },
  });

  const glowPulse = interpolate(
    Math.sin((frame / fps) * Math.PI * 2),
    [-1, 1],
    [0.7, 1.0]
  );

  return (
    <AbsoluteFill
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: FONT_STACK,
        color: "#ffffff",
      }}
    >
      <div
        style={{
          width: "90%",
          maxWidth: 960,
          background: "linear-gradient(180deg, rgba(20, 24, 38, 0.95) 0%, rgba(10, 12, 20, 0.98) 100%)",
          border: "2px solid rgba(139, 92, 246, 0.5)",
          boxShadow: `0 0 ${40 * glowPulse}px rgba(139, 92, 246, 0.35), 0 20px 50px rgba(0,0,0,0.8)`,
          borderRadius: 36,
          padding: "48px 36px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          transform: `scale(${cardScale})`,
          boxSizing: "border-box",
        }}
      >
        {/* Header Badge */}
        <div
          style={{
            background: "linear-gradient(90deg, #8b5cf6, #ec4899)",
            padding: "8px 24px",
            borderRadius: 999,
            fontSize: 24,
            fontWeight: 800,
            letterSpacing: 2,
            marginBottom: 16,
            textTransform: "uppercase",
          }}
        >
          {title}
        </div>

        {/* Subtitle */}
        <div
          style={{
            fontSize: 32,
            color: "#94a3b8",
            fontWeight: 600,
            marginBottom: 36,
            textAlign: "center",
          }}
        >
          {subtitle}
        </div>

        {/* 4 Pillars Grid (년주, 월주, 일주, 시주) */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 16,
            width: "100%",
            marginBottom: 36,
          }}
        >
          {pillars.map((pillar, idx) => {
            const heavenlyStyle = getElementStyle(pillar.heavenly.element);
            const earthlyStyle = getElementStyle(pillar.earthly.element);
            const isDayMaster = idx === 1; // 일주 (본인) 강조

            return (
              <div
                key={pillar.role}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  background: isDayMaster ? "rgba(139, 92, 246, 0.15)" : "rgba(255, 255, 255, 0.03)",
                  border: isDayMaster ? "2px solid #8b5cf6" : "1px solid rgba(255, 255, 255, 0.1)",
                  borderRadius: 20,
                  padding: "20px 8px",
                  boxShadow: isDayMaster ? "0 0 24px rgba(139, 92, 246, 0.4)" : "none",
                }}
              >
                <div style={{ fontSize: 18, color: isDayMaster ? "#c4b5fd" : "#64748b", fontWeight: 700, marginBottom: 12 }}>
                  {pillar.role}
                </div>

                {/* Heavenly Stem (천간) */}
                <div
                  style={{
                    width: 72,
                    height: 72,
                    borderRadius: 16,
                    background: heavenlyStyle.bg,
                    border: `2px solid ${heavenlyStyle.border}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 40,
                    fontWeight: 900,
                    color: heavenlyStyle.text,
                    marginBottom: 10,
                  }}
                >
                  {pillar.heavenly.char}
                </div>

                {/* Earthly Branch (지지) */}
                <div
                  style={{
                    width: 72,
                    height: 72,
                    borderRadius: 16,
                    background: earthlyStyle.bg,
                    border: `2px solid ${earthlyStyle.border}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 40,
                    fontWeight: 900,
                    color: earthlyStyle.text,
                  }}
                >
                  {pillar.earthly.char}
                </div>
              </div>
            );
          })}
        </div>

        {/* Destiny Keyword Tag */}
        <div
          style={{
            width: "100%",
            background: "rgba(255, 255, 255, 0.05)",
            border: "1px solid rgba(255, 255, 255, 0.15)",
            borderRadius: 18,
            padding: "16px 20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
          }}
        >
          <span style={{ fontSize: 28 }}>🔮</span>
          <span style={{ fontSize: 26, fontWeight: 700, color: "#f8fafc" }}>
            {destinyKeyword}
          </span>
        </div>
      </div>
    </AbsoluteFill>
  );
};
