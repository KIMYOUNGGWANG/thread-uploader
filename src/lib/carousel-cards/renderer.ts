import type { CarouselSlideData, CarouselThemeConfig } from "./templates";
import { DEFAULT_CAROUSEL_THEME } from "./templates";

export interface RenderedSlide {
  readonly slideIndex: number;
  readonly archetype: string;
  readonly htmlContent: string;
  readonly svgMarkup: string;
}

export function buildCarouselSlideHtml(
  slide: CarouselSlideData,
  slideIndex: number,
  totalSlides: number,
  theme: CarouselThemeConfig = DEFAULT_CAROUSEL_THEME
): string {
  const { primaryColor, backgroundColor, textColor, accentColor } = theme;
  const itemsHtml = slide.items?.length
    ? `<ul style="margin-top: 32px; font-size: 28px; line-height: 1.6; list-style: none; padding: 0;">
        ${slide.items
          .map(
            (item) =>
              `<li style="margin-bottom: 16px; display: flex; align-items: flex-start;">
                <span style="color: ${accentColor}; font-weight: bold; margin-right: 16px;">✓</span>
                <span>${escapeHtml(item)}</span>
              </li>`
          )
          .join("")}
       </ul>`
    : "";

  const highlightHtml = slide.highlightText
    ? `<div style="background: rgba(99, 102, 241, 0.15); border-left: 6px solid ${accentColor}; padding: 24px; border-radius: 8px; margin-top: 24px;">
        <span style="font-size: 36px; font-weight: 800; color: ${accentColor}; display: block; font-family: monospace;">${escapeHtml(
          slide.highlightText
        )}</span>
       </div>`
    : "";

  const subtitleHtml = slide.subtitle
    ? `<p style="font-size: 26px; color: #94a3b8; margin-top: 16px; line-height: 1.5;">${escapeHtml(
        slide.subtitle
      )}</p>`
    : "";

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      width: 1080px;
      height: 1080px;
      background: ${backgroundColor};
      color: ${textColor};
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 80px;
      overflow: hidden;
    }
    .badge {
      display: inline-block;
      padding: 8px 20px;
      background: ${primaryColor};
      color: #ffffff;
      border-radius: 20px;
      font-size: 20px;
      font-weight: 700;
      letter-spacing: 0.05em;
      text-transform: uppercase;
    }
    .footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-top: 2px solid rgba(255, 255, 255, 0.1);
      padding-top: 32px;
      font-size: 22px;
      color: #64748b;
    }
  </style>
</head>
<body>
  <div>
    <div style="display: flex; justify-content: space-between; align-items: center;">
      <span class="badge">${escapeHtml(slide.archetype.replace(/_/g, " "))}</span>
      <span style="font-size: 22px; font-weight: 600; color: #64748b;">${slideIndex + 1} / ${totalSlides}</span>
    </div>
    <div style="margin-top: 48px;">
      <h1 style="font-size: 54px; font-weight: 800; line-height: 1.25; color: ${textColor}; word-break: keep-all;">
        ${escapeHtml(slide.title)}
      </h1>
      ${subtitleHtml}
      ${highlightHtml}
      ${itemsHtml}
    </div>
  </div>
  <div class="footer">
    <span>${escapeHtml(slide.footerText || "Swipe to learn more →")}</span>
    <span style="font-weight: 700; color: ${accentColor};">Threads Portfolio Growth OS</span>
  </div>
</body>
</html>`;
}

export function buildCarouselSlideSvg(
  slide: CarouselSlideData,
  slideIndex: number,
  totalSlides: number,
  theme: CarouselThemeConfig = DEFAULT_CAROUSEL_THEME
): string {
  const { primaryColor, backgroundColor, textColor, accentColor } = theme;
  const titleText = escapeHtml(slide.title);
  const subtitleText = slide.subtitle ? escapeHtml(slide.subtitle) : "";
  const highlightText = slide.highlightText ? escapeHtml(slide.highlightText) : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080" viewBox="0 0 1080 1080">
  <rect width="1080" height="1080" fill="${backgroundColor}"/>
  <!-- Top bar -->
  <rect x="80" y="80" width="220" height="44" rx="22" fill="${primaryColor}"/>
  <text x="190" y="108" font-family="sans-serif" font-size="20" font-weight="bold" fill="#ffffff" text-anchor="middle">${escapeHtml(
    slide.archetype.replace(/_/g, " ")
  )}</text>
  <text x="1000" y="108" font-family="sans-serif" font-size="22" font-weight="bold" fill="#64748b" text-anchor="end">${
    slideIndex + 1
  } / ${totalSlides}</text>

  <!-- Title -->
  <foreignObject x="80" y="180" width="920" height="700">
    <div xmlns="http://www.w3.org/1999/xhtml" style="color: ${textColor}; font-family: sans-serif;">
      <h1 style="font-size: 52px; font-weight: 800; line-height: 1.25; margin-bottom: 24px;">${titleText}</h1>
      ${
        subtitleText
          ? `<p style="font-size: 26px; color: #94a3b8; line-height: 1.5; margin-bottom: 32px;">${subtitleText}</p>`
          : ""
      }
      ${
        highlightText
          ? `<div style="background: rgba(99, 102, 241, 0.2); border-left: 6px solid ${accentColor}; padding: 24px; border-radius: 8px; font-size: 36px; font-weight: bold; color: ${accentColor}; margin-bottom: 32px;">${highlightText}</div>`
          : ""
      }
      ${
        slide.items?.length
          ? `<ul style="font-size: 26px; line-height: 1.6; list-style: none; padding: 0;">
              ${slide.items
                .map(
                  (item) =>
                    `<li style="margin-bottom: 14px;">✔ ${escapeHtml(item)}</li>`
                )
                .join("")}
            </ul>`
          : ""
      }
    </div>
  </foreignObject>

  <!-- Footer -->
  <line x1="80" y1="960" x2="1000" y2="960" stroke="#334155" stroke-width="2"/>
  <text x="80" y="1010" font-family="sans-serif" font-size="22" fill="#64748b">${escapeHtml(
    slide.footerText || "Swipe →"
  )}</text>
  <text x="1000" y="1010" font-family="sans-serif" font-size="22" font-weight="bold" fill="${accentColor}" text-anchor="end">Threads Portfolio Growth OS</text>
</svg>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function svgToDataUri(svg: string): string {
  const base64 = Buffer.from(svg).toString("base64");
  return `data:image/svg+xml;base64,${base64}`;
}
