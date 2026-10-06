export interface ParsedCardData {
  hook: string;
  sub: string;
  items: string[];
  slideIndex: number;
  totalSlides?: number;
  isCarouselDetail?: boolean;
}

export function parsePostForCard(content: string): ParsedCardData {
  const lines = content.split("\n").map((l) => l.trim()).filter(Boolean);
  const hook = lines[0] || "운명과 타이밍의 법칙";

  const items: string[] = [];
  let sub = "";

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (/^[▶\-\*•]?\s*[A-C]\./i.test(line) || /^[A-C]\s*[\:\.]/i.test(line)) {
      items.push(line.replace(/^[▶\-\*•]\s*/, ""));
    } else if (!sub && !line.includes("체크해봐") && !line.includes("어디에 가까워") && !line.startsWith("👉")) {
      sub = line;
    }
  }

  return { hook, sub, items: items.slice(0, 3), slideIndex: 0 };
}

export function parsePostForSlide(content: string, slideIndex: number): ParsedCardData {
  // 1. Check if explicitly split by markdown horizontal rule (---)
  const sections = content
    .split(/\n\s*---\s*\n/)
    .map((s) => s.trim())
    .filter(Boolean);

  if (sections.length > 1) {
    const targetSection = sections[slideIndex] ?? sections[0];
    const parsed = parsePostForCard(targetSection);
    return {
      ...parsed,
      slideIndex,
      totalSlides: sections.length,
      isCarouselDetail: slideIndex > 0,
    };
  }

  // 2. If single section, parse default card
  const baseCard = parsePostForCard(content);

  if (slideIndex === 0 || baseCard.items.length === 0) {
    return {
      ...baseCard,
      slideIndex: 0,
      totalSlides: baseCard.items.length > 0 ? baseCard.items.length + 1 : 1,
      isCarouselDetail: false,
    };
  }

  // 3. Fallback for slideIndex > 0: Map to corresponding item (slideIndex 1 -> item 0, etc.)
  const targetItemIndex = slideIndex - 1;
  const targetItem = baseCard.items[targetItemIndex] || baseCard.items[0];

  return {
    hook: targetItem,
    sub: `${baseCard.hook}에 대한 상세 진단 및 해결 가이드`,
    items: [],
    slideIndex,
    totalSlides: baseCard.items.length + 1,
    isCarouselDetail: true,
  };
}
