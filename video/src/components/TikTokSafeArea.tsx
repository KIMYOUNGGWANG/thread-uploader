// TikTokSafeArea.tsx — Enforces TikTok 9:16 safe area margins.
// TikTok UI overlays elements:
// - Top: Search bar, Following/For You tabs (~140px)
// - Right: Profile, Like, Comment, Bookmark, Share icons (~160px)
// - Bottom: Account handle, sound title, caption text (~340px)
import React from "react";
import { AbsoluteFill } from "remotion";

export interface TikTokSafeAreaProps {
  children: React.ReactNode;
  debugOverlay?: boolean;
}

export const TIKTOK_SAFE_AREA_MARGINS = {
  top: 140,
  bottom: 340,
  left: 60,
  right: 160,
};

export const TikTokSafeArea: React.FC<TikTokSafeAreaProps> = ({
  children,
  debugOverlay = false,
}) => {
  return (
    <AbsoluteFill
      style={{
        paddingTop: TIKTOK_SAFE_AREA_MARGINS.top,
        paddingBottom: TIKTOK_SAFE_AREA_MARGINS.bottom,
        paddingLeft: TIKTOK_SAFE_AREA_MARGINS.left,
        paddingRight: TIKTOK_SAFE_AREA_MARGINS.right,
        boxSizing: "border-box",
        pointerEvents: "none",
      }}
    >
      {debugOverlay && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            border: "2px dashed rgba(255, 0, 80, 0.6)",
            pointerEvents: "none",
          }}
        />
      )}
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          position: "relative",
        }}
      >
        {children}
      </div>
    </AbsoluteFill>
  );
};
