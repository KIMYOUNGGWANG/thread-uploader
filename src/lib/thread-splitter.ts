/**
 * Thread Splitter
 * Splits long-form content (> 500 chars) into connected multi-part Threads (1/n, 2/n...)
 * Inspired by autoTHREADS 1/n thread chaining logic.
 */

export const THREADS_SINGLE_MAX_LENGTH = 500;
export const THREADS_PART_SAFE_LENGTH = 480;
export const THREADS_MAX_PARTS = 5;
export const THREADS_CHAIN_MAX_LENGTH = THREADS_PART_SAFE_LENGTH * THREADS_MAX_PARTS; // 2,400 chars

export interface SplitOptions {
  maxLength?: number;
  maxParts?: number;
  numberingStyle?: "plain" | "brackets" | "parentheses"; // "1/3" vs "[1/3]" vs "(1/3)"
}

export function isMultiPartThread(content: string): boolean {
  return content.trim().length > THREADS_SINGLE_MAX_LENGTH;
}

/**
 * Splits text into paragraphs or sentences while preserving meaning.
 */
function breakIntoChunks(text: string): string[] {
  // First split by double newlines (paragraphs)
  const paragraphs = text.split(/\n\s*\n/);
  const chunks: string[] = [];

  for (const para of paragraphs) {
    const trimmedPara = para.trim();
    if (!trimmedPara) continue;

    if (trimmedPara.length <= THREADS_PART_SAFE_LENGTH - 30) {
      chunks.push(trimmedPara);
    } else {
      // Split large paragraph by single newlines
      const lines = trimmedPara.split(/\n/);
      for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine) continue;

        if (trimmedLine.length <= THREADS_PART_SAFE_LENGTH - 30) {
          chunks.push(trimmedLine);
        } else {
          // Split line by sentence terminators (. ! ? followed by space or end)
          const sentences = trimmedLine.match(/[^.!?]+[.!?]+(?:\s+|$)|[^.!?]+$/g) || [trimmedLine];
          for (const sentence of sentences) {
            const trimmedSentence = sentence.trim();
            if (!trimmedSentence) continue;
            if (trimmedSentence.length <= THREADS_PART_SAFE_LENGTH - 30) {
              chunks.push(trimmedSentence);
            } else {
              // Further split long sentence by spaces or word boundaries
              const words = trimmedSentence.split(/\s+/);
              let currentWordChunk = "";
              for (const word of words) {
                if (currentWordChunk.length + word.length + 1 <= THREADS_PART_SAFE_LENGTH - 50) {
                  currentWordChunk = currentWordChunk ? `${currentWordChunk} ${word}` : word;
                } else {
                  if (currentWordChunk) chunks.push(currentWordChunk);
                  currentWordChunk = word;
                }
              }
              if (currentWordChunk) chunks.push(currentWordChunk);
            }
          }
        }
      }
    }
  }

  return chunks;
}

function formatPartPrefix(index: number, total: number, style: "plain" | "brackets" | "parentheses"): string {
  const num = `${index + 1}/${total}`;
  switch (style) {
    case "brackets":
      return `[${num}]\n\n`;
    case "parentheses":
      return `(${num})\n\n`;
    case "plain":
    default:
      return `${num}\n\n`;
  }
}

/**
 * Splits a long text into up to maxParts thread items with 1/n prefix numbering.
 */
export function splitContentIntoThreadParts(
  content: string,
  options: SplitOptions = {}
): string[] {
  const trimmed = content.trim();
  if (trimmed.length <= THREADS_SINGLE_MAX_LENGTH) {
    return [trimmed];
  }

  const maxLength = options.maxLength ?? THREADS_PART_SAFE_LENGTH;
  const maxParts = options.maxParts ?? THREADS_MAX_PARTS;
  const numberingStyle = options.numberingStyle ?? "plain";

  const baseChunks = breakIntoChunks(trimmed);
  if (baseChunks.length === 0) return [trimmed];

  // Try packing into 2 to maxParts parts
  for (let targetParts = 2; targetParts <= maxParts; targetParts++) {
    const chunks = [...baseChunks];
    const parts: string[] = [];
    let chunkIndex = 0;

    for (let p = 0; p < targetParts; p++) {
      const prefix = formatPartPrefix(p, targetParts, numberingStyle);
      const availableLength = maxLength - prefix.length;
      let partBody = "";

      while (chunkIndex < chunks.length) {
        const nextChunk = chunks[chunkIndex];
        const separator = partBody.length > 0 ? "\n\n" : "";
        const candidateLength = partBody.length + separator.length + nextChunk.length;

        if (candidateLength <= availableLength) {
          partBody = partBody.length > 0 ? `${partBody}\n\n${nextChunk}` : nextChunk;
          chunkIndex++;
        } else {
          // Can't fit more in this part
          break;
        }
      }

      if (partBody.length === 0 && chunkIndex < chunks.length) {
        // Fallback: chunk exceeds availableLength, slice safely
        const nextChunk = chunks[chunkIndex];
        const sliceLength = Math.max(50, availableLength);
        partBody = nextChunk.slice(0, sliceLength);
        chunks[chunkIndex] = nextChunk.slice(sliceLength).trim();
      }

      parts.push(`${prefix}${partBody}`);
    }

    if (chunkIndex >= chunks.length) {
      // Successfully packed all chunks within targetParts!
      return parts;
    }
  }

  // If even maxParts couldn't fit cleanly, greedy pack up to maxParts
  const finalParts: string[] = [];
  let remainingText = trimmed;

  for (let i = 0; i < maxParts; i++) {
    const prefix = formatPartPrefix(i, maxParts, numberingStyle);
    const availableLength = maxLength - prefix.length;

    if (i === maxParts - 1) {
      // Last part takes the remainder (up to limit)
      const chunk = remainingText.slice(0, availableLength).trim();
      finalParts.push(`${prefix}${chunk}`);
      break;
    }

    // Find best breakpoint near availableLength
    let cutPoint = availableLength;
    const window = remainingText.slice(0, availableLength);
    const lastParagraphBreak = window.lastIndexOf("\n\n");
    const lastLineBreak = window.lastIndexOf("\n");
    const lastSentenceBreak = Math.max(window.lastIndexOf(". "), window.lastIndexOf("! "), window.lastIndexOf("? "));

    if (lastParagraphBreak > availableLength * 0.6) {
      cutPoint = lastParagraphBreak;
    } else if (lastLineBreak > availableLength * 0.7) {
      cutPoint = lastLineBreak;
    } else if (lastSentenceBreak > availableLength * 0.7) {
      cutPoint = lastSentenceBreak + 1;
    }

    const chunk = remainingText.slice(0, cutPoint).trim();
    finalParts.push(`${prefix}${chunk}`);
    remainingText = remainingText.slice(cutPoint).trim();
    if (!remainingText) break;
  }

  return finalParts;
}
