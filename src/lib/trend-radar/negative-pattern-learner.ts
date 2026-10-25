export interface BottomPostSample {
  id: string;
  content: string;
  views: number;
  replies: number;
  reposts: number;
}

const CANDIDATE_CLICHE_PATTERNS = [
  /결론부터\s*말씀드리자면/,
  /알아보도록\s*하겠습니다/,
  /누구나\s*살면서\s*한\s*번쯤/,
  /스스로를\s*믿으세요/,
  /다\s*잘될\s*거예요/,
  /오늘\s*하루도\s*화이팅/,
  /참고해보세요/,
  /도움이\s*되셨으면/,
];

export function identifyBottomPerformingPosts(
  posts: BottomPostSample[],
  bottomFraction: number = 0.1
): BottomPostSample[] {
  if (posts.length === 0) return [];

  const scored = posts.map((p) => {
    const score = (p.views || 0) + (p.replies || 0) * 5 + (p.reposts || 0) * 10;
    return { post: p, score };
  });

  scored.sort((a, b) => a.score - b.score);
  const count = Math.max(1, Math.ceil(posts.length * bottomFraction));
  return scored.slice(0, count).map((s) => s.post);
}

export function extractNegativeCliches(bottomPosts: BottomPostSample[]): string[] {
  const discovered = new Set<string>();

  for (const post of bottomPosts) {
    const lines = post.content.split("\n").map((l) => l.trim()).filter(Boolean);
    const opening = lines.slice(0, 2).join(" ");

    for (const pattern of CANDIDATE_CLICHE_PATTERNS) {
      const match = opening.match(pattern);
      if (match) {
        discovered.add(match[0]);
      }
    }

    // Also flag excessively formal opening if present
    if (/(?:입니다|합니다|습니다|바랍니다)/.test(lines[0] || "")) {
      const formalOpening = lines[0].slice(0, 25);
      if (formalOpening.length >= 8) {
        discovered.add(formalOpening);
      }
    }
  }

  return Array.from(discovered);
}

// Learned phrases live apart from hand-set prohibitedPhrases and are replaced every run:
// a bottom 10% always exists, so unioning them grew the list daily without new evidence.
export function mergeNegativePhrasesIntoBrandConfig(
  currentConfig: Record<string, unknown>,
  newPhrases: string[]
): Record<string, unknown> & { fidelity: Record<string, unknown> & { learnedProhibitedPhrases: string[] } } {
  const fidelity = currentConfig.fidelity;
  const currentFidelity: Record<string, unknown> =
    typeof fidelity === "object" && fidelity !== null ? (fidelity as Record<string, unknown>) : {};

  return {
    ...currentConfig,
    fidelity: {
      ...currentFidelity,
      learnedProhibitedPhrases: Array.from(new Set(newPhrases)),
    },
  };
}

// Reads hand-set and learned phrases straight from the stored JSON (parseBrandConfig does not model fidelity).
export function readProhibitedPhrases(rawBrandConfig: string | null | undefined): string[] {
  try {
    const parsed: unknown = JSON.parse(rawBrandConfig || "{}");
    if (typeof parsed !== "object" || parsed === null) return [];
    const fidelity = (parsed as Record<string, unknown>).fidelity;
    if (typeof fidelity !== "object" || fidelity === null) return [];
    const { prohibitedPhrases, learnedProhibitedPhrases } = fidelity as Record<string, unknown>;
    const phrases = [prohibitedPhrases, learnedProhibitedPhrases].flatMap((list) => (Array.isArray(list) ? list : []));
    return Array.from(new Set(phrases.filter((phrase): phrase is string => typeof phrase === "string" && phrase.trim().length > 0)));
  } catch {
    return [];
  }
}

export function findProhibitedPhrases(post: string, phrases: string[]): string[] {
  return phrases.filter((phrase) => post.includes(phrase));
}
