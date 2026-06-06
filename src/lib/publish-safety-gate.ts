import { getThreadsContentLimitError } from "@/lib/threads-limits";
import { hasFortuneOverclaim, hasReplyBurdenPromise } from "@/lib/viral-intent-modes";

const GENERATED_META_PATTERNS = [
  /자수\s*체크/,
  /글자\s*수\s*확인/,
  /공백[·\s]*줄바꿈.*포함/,
  /500자\s*이하\s*통과/,
  /Threads\s*본문/,
  /초안\s*작성/,
];

export interface PublishSafetyPost {
  content: string;
  firstComment: string | null;
}

export function getPublishSafetyBlockReasons(post: PublishSafetyPost): string[] {
  const reasons: string[] = [];
  const lengthError = getThreadsContentLimitError(post.content);
  if (lengthError) reasons.push(lengthError);

  const surface = [post.content, post.firstComment ?? ""].join("\n");
  if (hasReplyBurdenPromise(surface)) {
    reasons.push("reply-burden CTA 포함");
  }
  if (hasFortuneOverclaim(surface)) {
    reasons.push("overclaim 운세/상대 마음 보장 표현 포함");
  }
  if (GENERATED_META_PATTERNS.some((pattern) => pattern.test(surface))) {
    reasons.push("generated meta text 포함");
  }

  return reasons;
}
