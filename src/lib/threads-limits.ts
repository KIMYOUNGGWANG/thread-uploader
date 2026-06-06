export const THREADS_CONTENT_MAX_LENGTH = 500;
export const THREADS_CONTENT_TARGET_LENGTH = 460;

export function getThreadsContentLimitError(content: string): string | null {
  if (content.length <= THREADS_CONTENT_MAX_LENGTH) return null;
  return `본문 ${content.length}/${THREADS_CONTENT_MAX_LENGTH}자 - Threads 업로드 제한 초과`;
}
