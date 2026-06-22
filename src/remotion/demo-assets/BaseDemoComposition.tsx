import React from "react";
import { Sequence, useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import type { RemotionInputProps, RemotionSequence, RemotionElement } from "../../lib/demo-assets/render-plan";
import { DeviceFrame } from "./components/DeviceFrame";

// ---------------------------------------------------------------------------
// Sub-elements with individual animations
// ---------------------------------------------------------------------------

const BackgroundElement: React.FC<{ element: RemotionElement }> = ({ element }) => {
  const cssStyle: React.CSSProperties = {
    position: "absolute",
    left: element.style.left,
    top: element.style.top,
    width: element.style.width,
    height: element.style.height,
    zIndex: element.style.zIndex,
    ...element.style.extra,
  };
  return <div style={cssStyle} />;
};

const AnimatedText: React.FC<{ element: RemotionElement }> = ({ element }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const activeFrame = Math.max(0, frame - element.animation.delay);

  let opacity = 0;
  let transform = "";

  if (element.animation.type === "slide-up") {
    const entry = spring({
      frame: activeFrame,
      fps,
      config: { damping: 14, mass: 0.5 },
    });
    opacity = entry;
    const translateY = interpolate(entry, [0, 1], [50, 0]);
    transform = `translateY(${translateY}px)`;
  } else if (element.animation.type === "spring-pop" || element.animation.type === "scale-bounce") {
    const entry = spring({
      frame: activeFrame,
      fps,
      config: { damping: 12, mass: 0.6 },
    });
    opacity = interpolate(entry, [0, 0.4], [0, 1]);
    transform = `scale(${entry})`;
  } else {
    // Default fade-in
    opacity = interpolate(activeFrame, [0, Math.max(1, element.animation.duration)], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
  }

  const cssStyle: React.CSSProperties = {
    position: "absolute",
    left: element.style.left,
    top: element.style.top,
    width: element.style.width,
    height: element.style.height,
    zIndex: element.style.zIndex,
    opacity,
    transform,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    whiteSpace: "pre-wrap",
    lineHeight: 1.35,
    ...element.style.extra,
  };

  const lines = element.content.split("\n");

  return (
    <div style={cssStyle}>
      {lines.map((line, idx) => (
        <div key={idx}>{line}</div>
      ))}
    </div>
  );
};

const AnimatedCTA: React.FC<{ element: RemotionElement }> = ({ element }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const activeFrame = Math.max(0, frame - element.animation.delay);

  const entry = spring({
    frame: activeFrame,
    fps,
    config: { damping: 10, mass: 0.5 },
  });

  const cssStyle: React.CSSProperties = {
    position: "absolute",
    left: element.style.left,
    top: element.style.top,
    width: element.style.width,
    height: element.style.height,
    zIndex: element.style.zIndex,
    opacity: interpolate(entry, [0, 0.5], [0, 1]),
    transform: `scale(${entry})`,
    boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
    ...element.style.extra,
  };

  return <div style={cssStyle}>{element.content}</div>;
};

// ---------------------------------------------------------------------------
// Active Scene sequence child
// ---------------------------------------------------------------------------

const ActiveScene: React.FC<{
  sequence: RemotionSequence;
  styleName: string;
}> = ({ sequence, styleName }) => {
  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      {sequence.elements.map((el) => {
        if (el.type === "background") {
          return <BackgroundElement key={el.id} element={el} />;
        }
        if (el.type === "device-mockup") {
          return (
            <DeviceFrame
              key={el.id}
              screenshotUrl={el.content}
              style={{
                position: "absolute",
                left: el.style.left,
                top: el.style.top,
                width: el.style.width,
                height: el.style.height,
                zIndex: el.style.zIndex,
              }}
              animation={el.animation}
              compositionStyle={styleName}
            />
          );
        }
        if (el.type === "headline" || el.type === "subtext") {
          return <AnimatedText key={el.id} element={el} />;
        }
        if (el.type === "cta-button") {
          return <AnimatedCTA key={el.id} element={el} />;
        }
        return null;
      })}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Base Composition
// ---------------------------------------------------------------------------

export const BaseDemoComposition: React.FC<RemotionInputProps> = ({
  colorTheme,
  sequences,
  style: styleName,
}) => {
  return (
    <div
      style={{
        position: "relative",
        width: 1080,
        height: 1920,
        backgroundColor: colorTheme.background,
        overflow: "hidden",
      }}
    >
      {sequences.map((seq) => (
        <Sequence key={seq.id} from={seq.from} durationInFrames={seq.durationInFrames}>
          <ActiveScene sequence={seq} styleName={styleName} />
        </Sequence>
      ))}
    </div>
  );
};
