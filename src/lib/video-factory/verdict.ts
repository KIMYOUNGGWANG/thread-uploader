export type Verdict = "good" | "bad";

export function isVerdict(value: unknown): value is Verdict {
  return value === "good" || value === "bad";
}

// Streak toward the "5 good in a row" exit bar: newest COMPLETED first, stop at the first non-good.
export function consecutiveGood(drafts: { status: string; userVerdict: string | null; createdAt: Date }[]): number {
  const completed = drafts
    .filter((d) => d.status === "COMPLETED")
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  const firstMiss = completed.findIndex((d) => d.userVerdict !== "good");
  return firstMiss === -1 ? completed.length : firstMiss;
}
