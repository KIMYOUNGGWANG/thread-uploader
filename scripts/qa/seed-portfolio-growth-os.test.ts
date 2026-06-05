import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { parseArgs, QA_IDS, QA_PRODUCTS } from "./seed-portfolio-growth-os.mjs";

describe("seed-portfolio-growth-os", () => {
  it("prints fixed QA ids without database writes when dry run is requested", () => {
    const output = execFileSync("node", ["scripts/qa/seed-portfolio-growth-os.mjs", "--dry-run"], {
      cwd: process.cwd(),
      encoding: "utf-8",
    });

    expect(output).toContain("ulw_qa_user_portfolio");
    expect(output).toContain("ulw_qa_user_empty_portfolio");
    expect(output).toContain("ulw_qa_product_cosmicpath");
    expect(output).toContain("ulw_qa_product_missing_prompt");
    expect(output).toContain("ulw_qa_product_no_posts");
    expect(output).toContain("No database writes performed");
  });

  it("recognizes apply mode without changing fixed ids", () => {
    expect(parseArgs(["--apply"])).toEqual({ apply: true, dryRun: false });
    expect(QA_PRODUCTS.map((product) => product.id)).toEqual([
      QA_IDS.cosmicPathProduct,
      QA_IDS.missingPromptProduct,
      QA_IDS.noPostsProduct,
    ]);
  });
});
