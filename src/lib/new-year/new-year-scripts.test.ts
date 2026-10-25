import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { NEW_YEAR_MODE_IDS } from "./new-year-season";

describe("스크립트의 신년 유형 목록", () => {
  it.each(["scripts/new-year-report.mjs", "scripts/analyze-post-response.mjs"])("%s가 모든 신년 유형을 안다", (file) => {
    const text = readFileSync(file, "utf8");
    for (const id of NEW_YEAR_MODE_IDS) expect(text, `${file}: ${id}`).toContain(`"${id}"`);
  });
});
