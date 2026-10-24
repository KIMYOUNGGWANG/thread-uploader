import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ShortsFilters } from "@/components/shorts/ShortsFilters";

describe("ShortsFilters", () => {
  it("keeps the current sort on window/region chips and the current filters on sort chips", () => {
    const out = renderToStaticMarkup(React.createElement(ShortsFilters, { window: "48", region: "all", sort: "outlier" }));
    expect(out).toContain('href="?window=24&amp;region=kr&amp;sort=outlier"');
    expect(out).toContain('href="?window=48&amp;region=all&amp;sort=velocity"');
    expect(out).toMatch(/aria-current="page"[^>]*>평소 대비순/);
  });
});
