import React from "react";
import { useCurrentFrame, useVideoConfig, spring } from "remotion";

interface DeviceFrameProps {
  screenshotUrl: string;
  style: React.CSSProperties;
  animation: {
    type: string;
    delay: number;
    duration: number;
  };
  compositionStyle: string;
}

export const DeviceFrame: React.FC<DeviceFrameProps> = ({
  screenshotUrl,
  style,
  animation,
  compositionStyle,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const activeFrame = Math.max(0, frame - animation.delay);
  
  // Floating offset using sine wave (only for premium floating dark style)
  const floatOffset = compositionStyle === "clean-product-demo"
    ? Math.sin(activeFrame / 15) * 12
    : 0;

  // Spring entry animation
  const entrySpring = spring({
    frame: activeFrame,
    fps,
    config: { damping: 14, mass: 0.6 },
  });

  // Calculate transform
  let transform = `scale(${entrySpring}) translateY(${floatOffset}px)`;
  if (compositionStyle === "clean-product-demo") {
    transform += ` rotateY(-10deg) rotateX(5deg)`;
  }

  if (!screenshotUrl) return null;

  return (
    <div
      style={{
        ...style,
        transform,
        transformStyle: "preserve-3d",
        perspective: 1200,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#0F172A",
        border: "12px solid rgba(255, 255, 255, 0.12)",
        borderRadius: "2.5rem",
        boxShadow: "0 40px 90px rgba(0, 0, 0, 0.6), inset 0 0 20px rgba(255, 255, 255, 0.05)",
        overflow: "hidden",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={screenshotUrl}
        alt="Mockup Screen"
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
        }}
      />
    </div>
  );
};
