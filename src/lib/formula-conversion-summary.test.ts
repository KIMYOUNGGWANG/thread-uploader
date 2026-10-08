import { describe, expect, it } from "vitest";
import { summarizeFormulaConversions } from "./formula-conversion-summary";

const post = (formulaId: string | null, status: string, clicks: number, conversions: number, paid = 0) =>
  ({ formulaId, status, clicks, conversions, manualPaidConversions: paid });

describe("summarizeFormulaConversions", () => {
  it("aggregates published posts per formula and ranks by paid then conversions", () => {
    const rows = summarizeFormulaConversions([
      post("dilemma", "PUBLISHED", 10, 2),
      post("dilemma", "PUBLISHED", 5, 1),
      post("ranking", "PUBLISHED", 40, 1, 1),
      post("dilemma", "PENDING", 99, 99),
      post(null, "PUBLISHED", 1, 0),
    ]);
    expect(rows.map((row) => row.formulaId)).toEqual(["ranking", "dilemma", "(none)"]);
    expect(rows[1]).toEqual({ formulaId: "dilemma", published: 2, clicks: 15, conversions: 3, paid: 0 });
  });
});
