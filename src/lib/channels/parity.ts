import type { PublicationMirror } from "./publication-mirror";

export interface StoredPublication {
  status: string;
  externalId: string | null;
  views: number | null;
}

/** Pure diff of the expected mirror vs the stored Publication; [] means they agree. */
export function comparePublication(expected: PublicationMirror | null, actual: StoredPublication | null): string[] {
  if (!expected) return actual ? ["unexpected publication"] : [];
  if (!actual) return ["missing publication"];
  const diffs: string[] = [];
  for (const field of ["status", "externalId", "views"] as const) {
    if (expected[field] !== actual[field]) diffs.push(`${field} ${expected[field]} != ${actual[field]}`);
  }
  return diffs;
}
