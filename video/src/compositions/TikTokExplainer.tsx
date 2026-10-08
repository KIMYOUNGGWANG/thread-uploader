// TikTokExplainer.tsx — 9:16 vertical composition specifically tailored for TikTok & Reels.
// Wraps VideoBase with TikTok safe area margins and custom overlay elements.
import React from "react";
import { AbsoluteFill } from "remotion";
import { VideoBase } from "../components/VideoBase";
import { TikTokSafeArea } from "../components/TikTokSafeArea";
import type { RenderSpec } from "../render-spec";

export const TikTokExplainer: React.FC<RenderSpec> = (props) => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#0b0d14" }}>
      <VideoBase {...props} />
      {/* Visual Safe Area Guide (optional/non-intrusive) */}
      <TikTokSafeArea>
        <div style={{ flex: 1 }} />
      </TikTokSafeArea>
    </AbsoluteFill>
  );
};
