import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Dashboard manual reference card", () => {
  // Rendering it only on the news tab unmounted it on a tab switch mid-request: input and the result were lost.
  it("stays mounted on every tab and is only hidden off the news tab", () => {
    const dashboard = readFileSync("src/components/Dashboard.tsx", "utf-8");
    expect(dashboard).toMatch(/<div hidden=\{activeTab !== "news"\}>\s*<ManualReferenceCard /);
    const newsBlock = dashboard.match(/\{activeTab === "news" && \(([\s\S]*?)\n\s*\)\}/)?.[1] ?? "";
    expect(newsBlock).toContain("<NewsTrendingTab");
    expect(newsBlock).not.toContain("ManualReferenceCard");
    expect(dashboard).toContain("onCreated={handleManualReferenceCreated}");
  });
});
