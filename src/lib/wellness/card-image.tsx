import type { ReactNode } from "react";
import { MAX_ITEMS, type CardSlide } from "@/lib/wellness/slides";

// Magazine-tone card for card-first brands, rendered by next/og (Satori: inline styles, flex only).
// No photos until image licensing is settled; type and colour carry the layout.
const C = {
  paper: "#F6F1EA",
  ink: "#24182F",
  muted: "#6F6478",
  accent: "#6A4C9C",
  highlight: "#E4D8F5",
  rule: "rgba(36, 24, 47, 0.14)",
};

const FONT_FAMILY = "Noto Sans KR";
const FONT_WEIGHTS = [500, 800] as const;

export function slideText(slide: CardSlide, brandName: string): string {
  return [slide.headline, slide.body ?? "", ...(slide.items ?? []), brandName, "WELLNESS × BUSINESS SAVE THIS 0123456789 / 넘겨서 보기 →"].join("");
}

// Satori ships one regular Latin face, so Korean headlines came out thin. Fetch a subset of Noto Sans KR per slide
// (the pattern from the @vercel/og docs). Fail-open: no fonts → the card still renders with the default face.
async function loadGoogleFont(weight: number, text: string): Promise<ArrayBuffer> {
  const url = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(FONT_FAMILY)}:wght@${weight}&text=${encodeURIComponent(text)}`;
  const css = await (await fetch(url, { signal: AbortSignal.timeout(8000) })).text();
  const source = css.match(/src: url\((.+?)\) format\('(opentype|truetype)'\)/)?.[1];
  if (!source) throw new Error("font url not found");
  const response = await fetch(source, { signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error(`font ${response.status}`);
  return response.arrayBuffer();
}

export async function loadCardFonts(text: string) {
  try {
    return await Promise.all(
      FONT_WEIGHTS.map(async (weight) => ({ name: FONT_FAMILY, data: await loadGoogleFont(weight, text), weight, style: "normal" as const })),
    );
  } catch (error) {
    console.warn("[wellness-card] font load failed, using default face:", error);
    return [];
  }
}

const headlineSize = (text: string, base: number) => (text.length > 40 ? base - 18 : text.length > 24 ? base - 8 : base);

function Frame({ index, total, label, children, footer }: { index: number; total: number; label: string; children: ReactNode; footer: string }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        backgroundColor: C.paper,
        color: C.ink,
        padding: "84px 88px",
        fontFamily: `"${FONT_FAMILY}", sans-serif`,
        wordBreak: "keep-all",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: "24px", fontWeight: 800, letterSpacing: "4px", color: C.accent }}>{label}</span>
        <span style={{ fontSize: "24px", fontWeight: 500, color: C.muted }}>{`${index + 1} / ${total}`}</span>
      </div>
      {children}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: `2px solid ${C.rule}`, paddingTop: "28px" }}>
        <span style={{ fontSize: "24px", fontWeight: 500, color: C.muted }}>{footer}</span>
        <span style={{ fontSize: "24px", color: C.accent }}>💜</span>
      </div>
    </div>
  );
}

export function WellnessCard({ slide, index, total, brandName }: { slide: CardSlide; index: number; total: number; brandName: string }) {
  const isCover = index === 0;
  const isLast = index === total - 1 && total > 1;
  const footer = isCover ? "넘겨서 보기 →" : brandName;

  if (isCover) {
    return (
      <Frame index={index} total={total} label="WELLNESS × BUSINESS" footer={footer}>
        <div style={{ display: "flex", flexDirection: "column", gap: "36px" }}>
          <div style={{ display: "flex", width: "96px", height: "8px", backgroundColor: C.accent }} />
          <div style={{ display: "flex", fontSize: `${headlineSize(slide.headline, 76)}px`, fontWeight: 800, lineHeight: 1.22, letterSpacing: "-1.5px" }}>
            {slide.headline}
          </div>
          {slide.body ? (
            <div style={{ display: "flex", fontSize: "34px", lineHeight: 1.5, color: C.muted, fontWeight: 500 }}>{slide.body}</div>
          ) : null}
        </div>
      </Frame>
    );
  }

  if (isLast) {
    return (
      <Frame index={index} total={total} label="SAVE THIS" footer={footer}>
        <div style={{ display: "flex", flexDirection: "column", gap: "32px", alignItems: "flex-start" }}>
          <div style={{ display: "flex", fontSize: "88px" }}>📩</div>
          <div style={{ display: "flex", fontSize: `${headlineSize(slide.headline, 60)}px`, fontWeight: 800, lineHeight: 1.3 }}>{slide.headline}</div>
          {slide.body ? <div style={{ display: "flex", fontSize: "32px", lineHeight: 1.5, color: C.muted }}>{slide.body}</div> : null}
        </div>
      </Frame>
    );
  }

  return (
    <Frame index={index} total={total} label={index === 1 ? "WHY" : String(index - 1).padStart(2, "0")} footer={footer}>
      <div style={{ display: "flex", flexDirection: "column", gap: "30px" }}>
        <div style={{ display: "flex" }}>
          <span
            style={{
              fontSize: `${headlineSize(slide.headline, 58)}px`,
              fontWeight: 800,
              lineHeight: 1.3,
              backgroundColor: C.highlight,
              padding: "6px 14px",
            }}
          >
            {slide.headline}
          </span>
        </div>
        {slide.body ? <div style={{ display: "flex", fontSize: "34px", lineHeight: 1.6, color: C.ink, fontWeight: 500 }}>{slide.body}</div> : null}
        {slide.items && slide.items.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
            {slide.items.slice(0, MAX_ITEMS).map((item, i) => (
              <div key={i} style={{ display: "flex", gap: "18px", fontSize: slide.items!.length > 4 ? "28px" : "32px", lineHeight: 1.45 }}>
                <span style={{ color: C.accent, fontWeight: 800 }}>{`${i + 1}`}</span>
                <span style={{ display: "flex", flex: 1 }}>{item}</span>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </Frame>
  );
}
