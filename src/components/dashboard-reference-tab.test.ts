import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Dashboard reference tab", () => {
  const dashboard = readFileSync("src/components/Dashboard.tsx", "utf-8");

  it("has a reference tab wired to ReferenceTab with the brand", () => {
    expect(dashboard).toContain('"feed" | "news" | "reference" | "interactions"');
    expect(dashboard).toContain('onClick={() => setActiveTab("reference")}');
    expect(dashboard).toMatch(/\{activeTab === "reference" && \(\s*<ReferenceTab brandId=\{brandId\} \/>/);
  });

  it("calls the list and decision endpoints with the brand id", () => {
    const tab = readFileSync("src/components/ReferenceTab.tsx", "utf-8");
    expect(tab).toContain("/api/viral/references?brandId=");
    expect(tab).toContain('method: "PATCH"');
    expect(tab).toContain("JSON.stringify({ brandId, decision })");
  });
});
