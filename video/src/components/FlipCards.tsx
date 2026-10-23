// FlipCards.tsx — ig_pickcard_16s A안: AI로 만든 카드 이미지 3장을 Remotion이 3D로 뒤집는다.
// 0~1초 카드 등장 → 1~4초 A·B·C 순서로 살짝 들렸다 내려감(고르라는 신호) → reveals[].atSeconds에 한 장씩 뒤집힘.
// 모든 움직임은 프레임 기반이라 렌더가 결정적이다. 이미지·효과음은 public/reels/cards/ (README 참고).
import React from "react";
import { AbsoluteFill, Audio, Img, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";

export interface FlipCardImages {
  back: string;
  fronts: string[];
  flipSound?: string;
}

const CARD_WIDTH = 260;
const CARD_HEIGHT = Math.round(CARD_WIDTH * (1024 / 688));
const CARD_GAP = 30;
const ENTER_STAGGER_SECONDS = 0.12;
const HOVER_START_SECONDS = 1.4;
const HOVER_GAP_SECONDS = 0.8;
const LABEL_COLORS = ["#c084fc", "#fbbf24", "#2dd4bf"];

const imageStyle: React.CSSProperties = { width: "100%", height: "100%", objectFit: "cover", borderRadius: 18 };

const FlipCard: React.FC<{ index: number; label: string; back: string; front: string; flipAtSeconds: number }> = ({ index, label, back, front, flipAtSeconds }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame: frame - Math.round(index * ENTER_STAGGER_SECONDS * fps), fps, config: { damping: 14, stiffness: 110 } });
  const hoverStart = Math.round((HOVER_START_SECONDS + index * HOVER_GAP_SECONDS) * fps);
  const hover = interpolate(frame, [hoverStart, hoverStart + 8, hoverStart + 20], [0, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const flip = spring({ frame: frame - Math.round(flipAtSeconds * fps), fps, config: { damping: 15, stiffness: 90 } });
  const flipped = flip > 0.5;
  const lift = Math.sin(Math.PI * flip) * 60 + hover * 28;
  const color = LABEL_COLORS[index] ?? LABEL_COLORS[0];

  return (
    // 투명도 대신 위치·크기로만 등장시킨다. 3D 회전 요소의 부모에 opacity를 걸면 Chrome이 카드를 빼먹는 프레임이 생겼다.
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 22, transform: `translateY(${(1 - enter) * 260}px) scale(${0.7 + enter * 0.3})` }}>
      <div
        style={{
          position: "relative",
          width: CARD_WIDTH,
          height: CARD_HEIGHT,
          transform: `translateY(${-lift}px) rotateY(${flip * 180}deg) scale(${1 + Math.sin(Math.PI * flip) * 0.08})`,
          boxShadow: flipped ? `0 0 46px ${color}aa` : `0 ${18 + lift / 3}px 40px rgba(0,0,0,0.65)`,
          borderRadius: 18,
        }}
      >
        {/* 앞뒷면을 겹치지 않고, 카드가 옆으로 선 90도 순간에 이미지를 바꿔 끼운다. 앞면은 좌우를 되돌려 정방향으로 보이게. */}
        {flipped ? <Img src={staticFile(front)} style={{ ...imageStyle, transform: "scaleX(-1)" }} /> : <Img src={staticFile(back)} style={imageStyle} />}
      </div>
      <div style={{ width: 72, height: 72, borderRadius: 36, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 42, fontWeight: 900, color: "#0b0d14", background: color, boxShadow: flipped ? `0 0 24px ${color}` : "none" }}>
        {label}
      </div>
    </div>
  );
};

export const FlipCards: React.FC<{ images: FlipCardImages; labels: string[]; flipAtSeconds: number[] }> = ({ images, labels, flipAtSeconds }) => {
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", paddingRight: 100, perspective: 1600 }}>
      <div style={{ display: "flex", gap: CARD_GAP, marginTop: 40 }}>
        {labels.map((label, index) => (
          <FlipCard
            key={label}
            index={index}
            label={label}
            back={images.back}
            front={images.fronts[index] ?? images.fronts[0] ?? images.back}
            flipAtSeconds={flipAtSeconds[index] ?? 99}
          />
        ))}
      </div>
      {images.flipSound
        ? flipAtSeconds.map((seconds) => (
            <Sequence key={seconds} from={Math.round(seconds * fps)}>
              <Audio src={staticFile(images.flipSound ?? "")} volume={0.9} />
            </Sequence>
          ))
        : null}
    </AbsoluteFill>
  );
};
