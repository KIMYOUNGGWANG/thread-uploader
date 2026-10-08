export interface FormulaConversionInput {
  formulaId: string | null;
  status: string;
  clicks: number | null;
  conversions: number | null;
  manualPaidConversions: number | null;
}

export interface FormulaConversionRow {
  formulaId: string;
  published: number;
  clicks: number;
  conversions: number;
  paid: number;
}

// Per-formula funnel for published posts, ranked by paid, then conversions, then clicks.
export function summarizeFormulaConversions(posts: FormulaConversionInput[]): FormulaConversionRow[] {
  const rows = new Map<string, FormulaConversionRow>();
  for (const post of posts) {
    if (post.status !== "PUBLISHED") continue;
    const formulaId = post.formulaId ?? "(none)";
    const row = rows.get(formulaId) ?? { formulaId, published: 0, clicks: 0, conversions: 0, paid: 0 };
    row.published += 1;
    row.clicks += post.clicks ?? 0;
    row.conversions += post.conversions ?? 0;
    row.paid += post.manualPaidConversions ?? 0;
    rows.set(formulaId, row);
  }
  return [...rows.values()].sort(
    (left, right) => right.paid - left.paid || right.conversions - left.conversions || right.clicks - left.clicks
  );
}
