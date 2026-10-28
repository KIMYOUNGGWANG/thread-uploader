import type { Prisma } from "@prisma/client";

export type ReviewDecisionKind = "APPROVED" | "REJECTED";

const MAX_REASON_LENGTH = 200;

interface ReviewedPost {
  id: string;
  brandId: string;
  status: string;
  formulaId: string | null;
  topic: string | null;
  hookType: string | null;
}

export function normalizeReviewReason(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().slice(0, MAX_REASON_LENGTH);
  return trimmed || null;
}

// Only a human decision on an unpublished draft counts: deleting a published post is cleanup, not a rejection.
export function reviewDecisionFor(
  post: ReviewedPost,
  decision: ReviewDecisionKind,
  reason: unknown,
): Prisma.ReviewDecisionUncheckedCreateInput | null {
  const reviewable = decision === "APPROVED" ? post.status === "NEEDS_REVIEW" : post.status === "NEEDS_REVIEW" || post.status === "PENDING";
  if (!reviewable) return null;
  return {
    brandId: post.brandId,
    postId: post.id,
    decision,
    reason: normalizeReviewReason(reason),
    formulaId: post.formulaId,
    topic: post.topic,
    hookType: post.hookType,
  };
}
