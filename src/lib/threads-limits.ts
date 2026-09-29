export const THREADS_CONTENT_MAX_LENGTH = 500;
export const THREADS_CONTENT_TARGET_LENGTH = 220; // optimal viral range: 140~240 chars
export const THREADS_VIRAL_MIN_LENGTH = 80;
export const THREADS_VIRAL_OPTIMAL_MAX = 260;
export const THREADS_MULTI_PART_MAX_LENGTH = 2400; // max 5 parts (each up to ~480 chars)

export function getThreadsContentLimitError(
  content: string,
  options?: { allowMultiPart?: boolean }
): string | null {
  if (options?.allowMultiPart) {
    if (content.length <= THREADS_MULTI_PART_MAX_LENGTH) return null;
    return `본문 ${content.length}/${THREADS_MULTI_PART_MAX_LENGTH}자 - 5단 스레드 최대 허용(2,400자) 초과`;
  }
  if (content.length <= THREADS_CONTENT_MAX_LENGTH) return null;
  return `본문 ${content.length}/${THREADS_CONTENT_MAX_LENGTH}자 - Threads 업로드 제한 초과`;
}
