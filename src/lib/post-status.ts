// A post may be sent back to the queue (PENDING / NEEDS_REVIEW) only from these statuses. Anything else is in flight,
// finished or archived: the publish cron claims PENDING posts, so moving a PUBLISHED or PUBLISHING post back to
// PENDING publishes it a second time. Same set the publish engine lets a human re-publish (see thread-resume-engine).
export const REQUEUEABLE_POST_STATUSES = ["PENDING", "NEEDS_REVIEW", "FAILED"];

export function isRequeueable(status: string | null | undefined): boolean {
  return typeof status === "string" && REQUEUEABLE_POST_STATUSES.includes(status);
}

export const REQUEUE_CONFLICT_MESSAGE = "이미 발행됐거나 발행 중인 글은 대기열로 되돌릴 수 없어요. 새로고침해서 현재 상태를 확인해 주세요.";

/** Prisma P2025: a write whose where (id + status) matched no row, e.g. the cron claimed the post after we read it. */
export function isRecordNotFoundError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2025";
}
