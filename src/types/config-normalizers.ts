export function isRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === "object" && input !== null;
}

export function normalizeIdentifier(input: unknown, fallback: string): string {
  return typeof input === "string" && input.trim()
    ? input.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_")
    : fallback;
}

export function normalizeText(input: unknown, fallback: string): string {
  return typeof input === "string" && input.trim() ? input.trim() : fallback;
}

export function normalizeStringList(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return Array.from(new Set(input
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter(Boolean)));
}

export function clampNumber(input: unknown, min: number, max: number, fallback: number): number {
  return typeof input === "number" && Number.isFinite(input)
    ? Math.min(max, Math.max(min, Math.round(input)))
    : fallback;
}
