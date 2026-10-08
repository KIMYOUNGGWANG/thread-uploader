// KineticText.tsx — Attention-grabbing 3-second viral hook typography for TikTok.
// Uses elastic spring entrance and high-contrast gradients to maximize initial retention.
import React from "react";
import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { FONT_STACK } from "../load-fonts";

export interface KineticTextProps {
  hookText: string;
  subText?: string;
  badge?: string;
  colorScheme?: "neon-yellow" | "electric-purple" | "fire-red";
}

const SCHEMES = {
  "neon-yellow": {
    gradient: "linear-gradient(180deg, #fef08a 0%, #facc15 100%)",
    shadow: "0 0 35px rgba(250, 204, 21, 0.6)",
    badgeBg: "#eab308",
  },
  "electric-purple": {
    gradient: "linear-gradient(180deg, #e9d5ff 0%, #a855f7 100%)",
    shadow: "0 0 35px rgba(168, 85, 247, 0.6)",
    badgeBg: "#9333ea",
  },
  "fire-red": {
    gradient: "linear-gradient(180deg, #fecaca 0%, #ef4444 100%)",
    shadow: "0 0 35px rgba(239, 68, 68, 0.6)",
    badgeBg: "#dc2626",
  },
};

export const KineticText: React.FC<KineticTextProps> = ({
  hookText,
  subText,
  badge = "⚠️ 주목",
  colorScheme = "neon-yellow",
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const activeScheme = SCHEMES[colorScheme];

  // Elastic pop-in
  const popScale = spring({
    frame,
    fps,
    config: { damping: 11, stiffness: 150 },
  });

  return (
    <AbsoluteFill
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: FONT_STACK,
        padding: "0 40px",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
          transform: `scale(${popScale})`,
          maxWidth: 920,
        }}
      >
        {badge && (
          <div
            style={{
              background: activeScheme.badgeBg,
              color: "#000000",
              fontWeight: 900,
              fontSize: 28,
              padding: "8px 24px",
              borderRadius: 999,
              marginBottom: 24,
              boxShadow: "0 4px 15px rgba(0,0,0,0.5)",
            }}
          >
            {badge}
          </div>
        )}

        <div
          style={{
            fontSize: 72,
            fontWeight: 900,
            lineHeight: 1.15,
            letterSpacing: -1.5,
            background: activeScheme.gradient,
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            filter: `drop-shadow(${activeScheme.shadow}) drop-shadow(0 4px 12px rgba(0,0,0,0.9))`,
            marginBottom: subText ? 20 : 0,
            wordBreak: "keep-all",
          }}
        >
          {hookText}
        </div>

        {subText && (
          <div
            style={{
              fontSize: 34,
              fontWeight: 700,
              color: "#e2e8f0",
              textShadow: "0 2px 10px rgba(0,0,0,0.8)",
              wordBreak: "keep-all",
              lineHeight: 1.35,
            }}
          >
            {subText}
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};
