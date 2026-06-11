import type { TikTokSceneBeat } from "@/types/tiktok-video";
import type { TikTokRenderPlan } from "@/lib/tiktok-video-renderer";

type TextWeight = "bold" | "normal";

const FONT_FAMILY = "-apple-system, BlinkMacSystemFont, 'Noto Sans KR', sans-serif";
const OPTION_PATTERN = /([ABC])\s*면\s*([^,/]+(?:\s+[^,/]+)?)/g;

export function drawTikTokFrame(
  context: CanvasRenderingContext2D,
  sceneBeats: readonly TikTokSceneBeat[],
  plan: TikTokRenderPlan,
  progress: number,
  elapsedSeconds: number
): void {
  const { width, height } = context.canvas;
  const pulse = 0.5 + Math.sin(progress * Math.PI * 10) * 0.5;
  const caption = currentTimedText(plan.captions, progress, plan.title);
  const body = currentBeatNarration(sceneBeats, plan.bodyLines, elapsedSeconds, progress);

  drawCinematicBackground(context, progress, pulse);
  drawNoiseVeil(context, progress);
  drawPill(context, 72, 84, plan.kicker, "rgba(255, 244, 250, 0.96)", "#be185d");
  drawWrappedText(context, caption, 78, 250, width - 156, 94, 4, "#ffffff", "bold");
  drawWrappedText(context, body, 92, 770, width - 184, 48, 4, "#f8fafc", "normal");
  drawOptionChips(context, plan.cta, 78, 1118, width - 156);
  drawCaptionCard(context, plan.cta, 78, 1320, width - 156);
  drawHashtags(context, plan.hashtags, 78, 1680, width - 156);
  drawProgress(context, 78, height - 108, width - 156, progress);
}

function drawCinematicBackground(context: CanvasRenderingContext2D, progress: number, pulse: number): void {
  const { width, height } = context.canvas;
  const gradient = context.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, "#0f172a");
  gradient.addColorStop(0.45, "#283593");
  gradient.addColorStop(1, "#db2777");
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);

  drawGlow(context, width * (0.79 + Math.sin(progress * Math.PI * 2) * 0.04), height * 0.18, 360, "rgba(255,255,255,0.13)");
  drawGlow(context, width * 0.16, height * (0.82 - progress * 0.08), 330, "rgba(255,255,255,0.10)");
  drawGlow(context, width * (0.52 + pulse * 0.06), height * 0.58, 160, "rgba(244,114,182,0.12)");
}

function drawNoiseVeil(context: CanvasRenderingContext2D, progress: number): void {
  const { width, height } = context.canvas;
  context.save();
  context.globalAlpha = 0.035;
  context.fillStyle = "#ffffff";
  for (let index = 0; index < 80; index++) {
    const x = (Math.sin(index * 41.13 + progress * 7) * 0.5 + 0.5) * width;
    const y = (Math.cos(index * 29.7 + progress * 5) * 0.5 + 0.5) * height;
    context.fillRect(x, y, 2, 2);
  }
  context.restore();
}

function drawGlow(context: CanvasRenderingContext2D, x: number, y: number, radius: number, color: string): void {
  context.fillStyle = color;
  context.beginPath();
  context.arc(x, y, radius, 0, Math.PI * 2);
  context.fill();
}

function drawOptionChips(context: CanvasRenderingContext2D, cta: string, x: number, y: number, maxWidth: number): void {
  const options = Array.from(cta.matchAll(OPTION_PATTERN)).slice(0, 3);
  if (options.length === 0) return;

  let cursorX = x;
  for (const option of options) {
    const label = `${option[1] ?? ""}. ${cleanDisplayText(option[2] ?? "")}`;
    context.font = `800 32px ${FONT_FAMILY}`;
    const chipWidth = Math.min(context.measureText(label).width + 46, maxWidth - (cursorX - x));
    if (chipWidth < 90) return;
    drawRoundedPanel(context, cursorX, y, chipWidth, 64, "rgba(255,255,255,0.16)", 32);
    context.fillStyle = "#ffffff";
    context.fillText(label, cursorX + 23, y + 43, chipWidth - 46);
    cursorX += chipWidth + 16;
  }
}

function drawCaptionCard(context: CanvasRenderingContext2D, cta: string, x: number, y: number, width: number): void {
  drawRoundedPanel(context, x, y, width, 250, "rgba(15, 23, 42, 0.74)", 30);
  drawWrappedText(context, "댓글로 지금 상태만 골라줘요", x + 40, y + 58, width - 80, 38, 1, "#f9a8d4", "bold");
  drawWrappedText(context, cta, x + 40, y + 128, width - 80, 46, 3, "#ffffff", "normal");
}

function drawHashtags(context: CanvasRenderingContext2D, hashtags: readonly string[], x: number, y: number, maxWidth: number): void {
  drawWrappedText(context, hashtags.join(" "), x, y, maxWidth, 34, 2, "#fbcfe8", "normal");
}

function drawProgress(context: CanvasRenderingContext2D, x: number, y: number, width: number, progress: number): void {
  drawRoundedPanel(context, x, y, width, 13, "rgba(255, 255, 255, 0.24)", 8);
  drawRoundedPanel(context, x, y, width * progress, 13, "#f472b6", 8);
}

function currentBeatNarration(
  sceneBeats: readonly TikTokSceneBeat[],
  fallbackLines: readonly string[],
  elapsedSeconds: number,
  progress: number
): string {
  const beat = sceneBeats.find((item) => elapsedSeconds >= item.startSecond && elapsedSeconds <= item.endSecond);
  if (beat?.narration) return cleanDisplayText(beat.narration);
  return currentTimedText(fallbackLines, progress, "");
}

function currentTimedText(items: readonly string[], progress: number, fallback: string): string {
  if (items.length === 0) return fallback;
  const index = Math.min(items.length - 1, Math.floor(progress * items.length));
  return items[index] ?? fallback;
}

function drawPill(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  text: string,
  background: string,
  foreground: string
): void {
  context.font = `800 34px ${FONT_FAMILY}`;
  const width = context.measureText(text).width + 52;
  drawRoundedPanel(context, x, y, width, 66, background, 34);
  context.fillStyle = foreground;
  context.fillText(text, x + 26, y + 44);
}

function drawRoundedPanel(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  fillStyle: string,
  radius: number
): void {
  context.fillStyle = fillStyle;
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
  context.fill();
}

function drawWrappedText(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number,
  color: string,
  weight: TextWeight
): void {
  context.fillStyle = color;
  context.font = `${weight === "bold" ? 850 : 600} ${lineHeight * 0.78}px ${FONT_FAMILY}`;
  wrapCanvasText(context, text, maxWidth, maxLines).forEach((line, index) => {
    context.fillText(line, x, y + index * lineHeight);
  });
}

function wrapCanvasText(context: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  const words = cleanDisplayText(text).split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (context.measureText(next).width <= maxWidth) {
      current = next;
    } else {
      if (current) lines.push(current);
      current = word;
    }
    if (lines.length === maxLines) break;
  }
  if (current && lines.length < maxLines) lines.push(current);
  const lastIndex = maxLines - 1;
  const lastLine = lines[lastIndex];
  if (lastLine && lines.length === maxLines && context.measureText(`${lastLine}...`).width <= maxWidth) {
    lines[lastIndex] = `${lastLine}...`;
  }
  return lines;
}

function cleanDisplayText(input: string): string {
  return input.replace(/\s+/g, " ").trim();
}
