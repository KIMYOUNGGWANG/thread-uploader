import { getPublishSafetyBlockReasons } from "@/lib/publish-safety-gate";
import type { AccountHealthState } from "@/types/brand";

export const NEWS_PLATFORMS = ["telegram", "threads", "kakao"] as const;
export type NewsPlatform = (typeof NEWS_PLATFORMS)[number];

export function isNewsPlatform(value: unknown): value is NewsPlatform {
  return typeof value === "string" && (NEWS_PLATFORMS as readonly string[]).includes(value);
}

export interface Fact {
  text: string;
  evidence: string;
  verified: boolean;
}

const MIN_EVIDENCE = 8;
const squash = (value: string) => value.replace(/\s+/g, " ").trim().toLowerCase();

/** A fact counts as verified only if its quoted evidence literally appears in the source text. */
export function verifyFacts(raw: Array<{ text: unknown; evidence: unknown }>, sourceText: string): Fact[] {
  const haystack = squash(sourceText);
  return raw.flatMap((entry) => {
    const text = typeof entry.text === "string" ? entry.text.trim() : "";
    const evidence = typeof entry.evidence === "string" ? entry.evidence.trim() : "";
    if (!text) return [];
    const verified = evidence.length >= MIN_EVIDENCE && haystack.includes(squash(evidence));
    return [{ text, evidence, verified }];
  });
}

const stripThousands = (value: string) => value.replace(/(\d),(?=\d{3}\b)/g, "$1");

/** Multi-digit numbers in the draft that never appear in the source: the cheapest hallucination tell. */
export function findUnsupportedNumbers(text: string, sourceText: string): string[] {
  const source = stripThousands(sourceText);
  const numbers = stripThousands(text.replace(/https?:\/\/\S+/g, " ")).match(/\d+(?:\.\d+)?/g) ?? [];
  return [...new Set(numbers.filter((n) => n.replace(".", "").length >= 2 && !source.includes(n)))];
}

// Telegram Bot API: message text 1-4096, media caption 0-1024 (core.telegram.org/bots/api, checked 2026-11-19).
export function telegramLimit(imageCount: number): number {
  return imageCount > 0 ? 1024 : 4096;
}

export interface VariantCheck {
  blockers: string[];
  warnings: string[];
}

export function checkVariant(input: {
  platform: NewsPlatform;
  text: string;
  imageCount: number;
  sourceText: string;
  threadsAccountHealth?: Partial<AccountHealthState>;
}): VariantCheck {
  const text = input.text.trim();
  const blockers: string[] = [];
  if (!text) blockers.push("원고가 비어 있어");
  if (input.platform === "telegram") {
    const limit = telegramLimit(input.imageCount);
    if (input.text.length > limit) {
      blockers.push(`텔레그램 ${input.imageCount > 0 ? "이미지 캡션" : "글"} 한도 ${input.text.length}/${limit}자 초과`);
    }
  }
  if (input.platform === "threads" && text) {
    // Same gate the publish cron applies (shadowban, length, reply-burden CTA, generated meta), as a single post.
    blockers.push(
      ...getPublishSafetyBlockReasons(
        { content: input.text, firstComment: null, postCategory: "NEWS" },
        { allowMultiPart: false, accountHealth: input.threadsAccountHealth },
      ),
    );
  }
  const unsupported = findUnsupportedNumbers(input.text, input.sourceText);
  const warnings = unsupported.length > 0 ? [`원문에 없는 숫자: ${unsupported.join(", ")}`] : [];
  return { blockers, warnings };
}
