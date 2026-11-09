import { isRecord } from "@/types/config-normalizers";
import type { VideoChannel } from "./config";

function parseJson(raw: string | null | undefined): unknown {
  try {
    return JSON.parse(raw || "null");
  } catch {
    return null;
  }
}

export function normalizeHashtag(tag: string): string | null {
  const clean = tag.trim().replace(/^#+/, "").replace(/\s+/g, "");
  return clean ? `#${clean}` : null;
}

/** Channel caption + the draft's hashtags (skipping ones already in the caption) + an optional suffix. */
export function buildVideoCaption(
  channel: VideoChannel,
  captionsRaw: string,
  hashtagsRaw: string,
  suffix = "",
): string {
  const captions = parseJson(captionsRaw);
  const base = isRecord(captions) && typeof captions[channel] === "string" ? (captions[channel] as string).trim() : "";
  const hashtags = parseJson(hashtagsRaw);
  const present = new Set((base.match(/#[^\s#]+/g) ?? []).map((t) => t.toLowerCase()));
  const tags = (Array.isArray(hashtags) ? hashtags : [])
    .flatMap((t) => (typeof t === "string" ? normalizeHashtag(t) ?? [] : []))
    .filter((t) => !present.has(t.toLowerCase()));
  const uniqueTags = [...new Set(tags)];
  return [base, uniqueTags.join(" "), suffix.trim()].filter(Boolean).join("\n\n");
}

/** Carousel caption: the post's opening (first two paragraphs) plus the brand suffix. */
export function buildCardCaption(content: string, suffix = ""): string {
  const paragraphs = content
    .split(/\n\s*---+\s*\n|\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .slice(0, 2);
  return [paragraphs.join("\n\n"), suffix.trim()].filter(Boolean).join("\n\n").slice(0, 2200);
}
