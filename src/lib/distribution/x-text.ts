/** X counts most non-Latin characters (Hangul, CJK, emoji) as 2 toward the 280 limit; URLs count as 23. */
export const X_MAX_WEIGHT = 280;
const URL_WEIGHT = 23;
const URL_PATTERN = /https?:\/\/\S+/g;

function charWeight(codePoint: number): number {
  if (codePoint <= 0x10ff) return 1;
  if (codePoint >= 0x2000 && codePoint <= 0x200d) return 1;
  if (codePoint >= 0x2010 && codePoint <= 0x201f) return 1;
  if (codePoint >= 0x2032 && codePoint <= 0x2037) return 1;
  return 2;
}

export function xWeightedLength(text: string): number {
  let weight = 0;
  const withoutUrls = text.replace(URL_PATTERN, () => {
    weight += URL_WEIGHT;
    return "";
  });
  for (const char of withoutUrls.normalize("NFC")) weight += charWeight(char.codePointAt(0) ?? 0);
  return weight;
}

function truncateToWeight(text: string, max: number): string {
  const ellipsis = "…";
  const limit = max - charWeight(ellipsis.codePointAt(0) ?? 0);
  let weight = 0;
  let out = "";
  for (const char of text) {
    const w = charWeight(char.codePointAt(0) ?? 0);
    if (weight + w > limit) return `${out.trimEnd()}${ellipsis}`;
    weight += w;
    out += char;
  }
  return out;
}

/**
 * Builds an X post from a Threads post: keeps whole paragraphs while they fit, drops markdown rules and
 * thread separators, and only cuts mid-paragraph when the first paragraph alone is too long.
 */
export function buildXText(content: string, max = X_MAX_WEIGHT): string {
  const paragraphs = content
    .replace(/\r\n/g, "\n")
    .split(/\n\s*(?:---+|\*\*\*+)\s*\n|\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (paragraphs.length === 0) return "";

  let text = "";
  for (const paragraph of paragraphs) {
    const next = text ? `${text}\n\n${paragraph}` : paragraph;
    if (xWeightedLength(next) > max) break;
    text = next;
  }
  return text || truncateToWeight(paragraphs[0], max);
}
