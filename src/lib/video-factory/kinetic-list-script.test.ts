import { describe, expect, it } from "vitest";
import { checkKineticListScript, forbiddenTermsFor } from "./kinetic-list-script";

const valid = () => ({
  hook: { kicker: "11월,", lines: ["이직", "고민 중이면"] },
  intro: { l1: "일간별로", l2: "딱 하나만" },
  items: [
    { glyph: "丙", label: "병화", action: ["제안 오면", "하루 안에 답하기"] },
    { glyph: "壬", label: "임수", action: ["연말까지는", "지금 자리 지키기"] },
    { glyph: "己", label: "기토", action: ["이력서보다", "서류 정리 먼저"] },
  ],
  cta: { l1: "내 일간 모르면", l2: "프로필 링크 → 1분" },
  captions: { instagram: "ig 캡션", youtube: "yt 캡션", tiktok: "tt 캡션" },
  hashtags: ["사주", "일간"],
});

function errorsOf(input: unknown, terms: string[] = []): string[] {
  const r = checkKineticListScript(input, terms);
  if (r.ok) throw new Error("expected failure");
  return r.errors;
}

describe("checkKineticListScript", () => {
  it("accepts the style-sample script", () => {
    const r = checkKineticListScript(valid(), []);
    expect(r.ok).toBe(true);
  });

  it("rejects a hook line over 8 chars", () => {
    const s = valid();
    s.hook.lines[1] = "고민 중이면 지금";
    expect(errorsOf(s).join("|")).toContain("hook.lines[1]");
  });

  it("rejects two items", () => {
    const s = valid();
    s.items.pop();
    expect(errorsOf(s).join("|")).toContain("items");
  });

  it("rejects a glyph outside KINETIC_GLYPHS", () => {
    const s = valid();
    s.items[0].glyph = "龍";
    expect(errorsOf(s).join("|")).toContain("items[0].glyph");
  });

  it("rejects a forbidden term in captions", () => {
    const s = valid();
    s.captions.tiktok = "부적 같은 하루";
    expect(errorsOf(s, ["부적"]).join("|")).toContain("captions.tiktok");
  });

  it("rejects a DM call to action", () => {
    const s = valid();
    s.cta.l2 = "댓글 달면 해석";
    expect(errorsOf(s).join("|")).toContain("cta.l2");
  });

  it("rejects non-object input", () => {
    expect(checkKineticListScript(null, []).ok).toBe(false);
    expect(checkKineticListScript("x", []).ok).toBe(false);
  });

  it("collects forbidden terms from the preset without duplicates", () => {
    const terms = forbiddenTermsFor("saju_viral");
    expect(terms).toContain("진태양시");
    expect(terms).toContain("부적");
    expect(new Set(terms).size).toBe(terms.length);
  });
});
