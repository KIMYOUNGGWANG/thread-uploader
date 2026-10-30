const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

export function kstDate(now: Date): string {
  return new Date(now.getTime() + KST_OFFSET_MS).toISOString().slice(0, 10);
}
