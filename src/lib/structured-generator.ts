import type { BrandProfile, ContentFormat } from "./brand-profile";

export interface CardSlideSpec {
  title: string;
  sub?: string;
  items?: string[];
}

export interface StructuredPostOutput {
  content: string;
  firstComment: string;
  format: ContentFormat;
  topic?: string;
  hookType?: string;
  ctaType?: string;
  viralIntentModeId?: string;
  cardSlides?: CardSlideSpec[];
}

export function parseStructuredPostOutput(rawText: string): StructuredPostOutput {
  const trimmed = rawText.trim();

  // 1. Try to find and parse JSON block
  const jsonMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || trimmed.match(/(\{[\s\S]*\})/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[1]);
      if (parsed && typeof parsed.content === "string") {
        return {
          content: parsed.content.trim(),
          firstComment: typeof parsed.firstComment === "string" ? parsed.firstComment.trim() : "",
          format: (parsed.format as ContentFormat) || "SINGLE_CARD",
          topic: parsed.topic,
          hookType: parsed.hookType,
          ctaType: parsed.ctaType,
          viralIntentModeId: parsed.viralIntentModeId,
          cardSlides: Array.isArray(parsed.cardSlides) ? parsed.cardSlides : undefined,
        };
      }
    } catch {
      // Continue to fallback
    }
  }

  // 2. Fallback: Legacy separator parsing
  const SEPARATOR = "===FIRST_COMMENT===";
  if (trimmed.includes(SEPARATOR)) {
    const [body, comment] = trimmed.split(SEPARATOR);
    return {
      content: body.trim(),
      firstComment: (comment || "").trim(),
      format: "SINGLE_CARD",
    };
  }

  // 3. Fallback: Plain text
  return {
    content: trimmed,
    firstComment: "",
    format: "SINGLE_CARD",
  };
}

export function generateCardUrlsForPost(
  postId: string,
  baseUrl: string,
  format: ContentFormat,
  slideCount: number = 1
): string[] {
  const cleanBase = baseUrl.replace(/\/+$/, "");

  if (format === "TEXT_ONLY" || slideCount <= 0) {
    return [];
  }

  if (format === "SINGLE_CARD" || slideCount === 1) {
    return [`${cleanBase}/api/cards/${postId}`];
  }

  // Carousel
  const urls: string[] = [];
  for (let i = 0; i < slideCount; i++) {
    urls.push(`${cleanBase}/api/cards/${postId}?slide=${i}`);
  }
  return urls;
}

export function buildStructuredPromptInstructions(
  profile: BrandProfile,
  format: ContentFormat
): string {
  const formatDescription =
    format === "CAROUSEL"
      ? "Create a 3-slide visual carousel structure (Cover slide + 2 breakdown slides)."
      : format === "SINGLE_CARD"
      ? "Create a single 1080x1080 visual summary card (Hook title, sub-headline, and A/B/C options)."
      : "Text-only post without image cards.";

  return `
[BRAND PERSONA & TONE]
Persona: ${profile.persona}
Tone: ${profile.tone}
Language: ${profile.language === "en" ? "English" : "Korean"}
Format: ${formatDescription}

[OUTPUT FORMAT REQUIREMENT]
You MUST respond with a valid JSON object wrapped in \`\`\`json \`\`\` code fences matching this schema:
{
  "content": "The full Threads post text, punchy and engaging, under 480 characters",
  "firstComment": "The direct CTA comment with link and value proposition",
  "format": "${format}",
  "topic": "Core topic name",
  "hookType": "The hook strategy used",
  "ctaType": "The conversion trigger used",
  "viralIntentModeId": "Selected viral mode ID",
  "cardSlides": [
    {
      "title": "Slide 1 Hook title (max 40 chars)",
      "sub": "Sub-hook explanation",
      "items": ["A. Choice 1", "B. Choice 2", "C. Choice 3"]
    }
  ]
}
`.trim();
}
