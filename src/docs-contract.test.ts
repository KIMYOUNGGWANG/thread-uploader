import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const DOC_FILES = [
  "README.md",
  "docs/api-spec.md",
  "docs/screen-flow.md",
  ".agent/memory/task_board.md",
];

function readProjectFile(path: string): string {
  return readFileSync(path, "utf-8");
}

describe("portfolio docs contract", () => {
  it("mentions internal owned products and 7-day evidence sprint", () => {
    const docs = DOC_FILES.map(readProjectFile).join("\n");

    expect(docs).toContain("Portfolio Growth OS");
    expect(docs).toContain("internal");
    expect(docs).toContain("owned products");
    expect(docs).toContain("7-day");
  });

  it("does not advertise external SaaS or payment surfaces", () => {
    const docs = DOC_FILES.map(readProjectFile).join("\n");

    expect(docs).not.toMatch(/Stripe|billing|pricing plan|public SaaS/i);
  });

  it("documents the implemented campaign summary shape", () => {
    const apiSpec = readProjectFile("docs/api-spec.md");

    expect(apiSpec).toContain("linkUrl: string | null");
    expect(apiSpec).toContain("utmContent: string | null");
    expect(apiSpec).toContain("replies: 40");
    expect(apiSpec).toContain("clicksConversions: 15");
    expect(apiSpec).not.toContain("hasLink: boolean");
  });
});
