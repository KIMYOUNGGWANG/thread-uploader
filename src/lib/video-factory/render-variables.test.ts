import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { KineticListScript } from "./kinetic-list-script";
import {
  buildKineticListVariables,
  DEFAULT_HOOK_SRC,
  KINETIC_LIST_VARIABLE_IDS,
} from "./render-variables";

const script: KineticListScript = {
  hook: { kicker: "11월,", lines: ["이직", "고민 중이면"] },
  intro: { l1: "일간별로", l2: "딱 하나만" },
  items: [
    { glyph: "丙", label: "병화", action: ["제안 오면", "하루 안에 답하기"] },
    { glyph: "壬", label: "임수", action: ["연말까지는", "지금 자리 지키기"] },
    { glyph: "己", label: "기토", action: ["이력서보다", "서류 정리 먼저"] },
  ],
  cta: { l1: "내 일간 모르면", l2: "프로필 링크 → 1분" },
  captions: { instagram: "i", youtube: "y", tiktok: "t" },
  hashtags: ["#사주"],
};

describe("buildKineticListVariables", () => {
  it("maps the script to every template variable", () => {
    const vars = buildKineticListVariables(script, "assets/img/x.png");
    expect(Object.keys(vars).sort()).toEqual([...KINETIC_LIST_VARIABLE_IDS].sort());
    expect(vars).toMatchObject({
      kicker: "11월,",
      hook1: "이직",
      hook2: "고민 중이면",
      intro1: "일간별로",
      intro2: "딱 하나만",
      g2: "壬",
      l2: "임수",
      a3a: "이력서보다",
      a3b: "서류 정리 먼저",
      cta2: "프로필 링크 → 1분",
    });
  });

  it("falls back to the default hook", () => {
    const vars = buildKineticListVariables(script, null);
    expect(vars.hookSrc).toBe(DEFAULT_HOOK_SRC);
    expect(vars.hookKind).toBe("image");
  });

  it("marks mp4 hooks as video", () => {
    expect(buildKineticListVariables(script, "https://blob.example/clip.MP4").hookKind).toBe("video");
    expect(buildKineticListVariables(script, "assets/clip.webm").hookKind).toBe("video");
    expect(buildKineticListVariables(script, "assets/img/a.jpg").hookKind).toBe("image");
  });

  it("matches the template variable ids", () => {
    const html = readFileSync(
      join(process.cwd(), "hyperframes/templates/kinetic-list/index.html"),
      "utf8",
    );
    const m = html.match(/data-composition-variables='([^']*)'/);
    expect(m).not.toBeNull();
    const decl: unknown = JSON.parse(m?.[1] ?? "[]");
    expect(Array.isArray(decl)).toBe(true);
    const ids = (decl as unknown[]).map((d) =>
      typeof d === "object" && d !== null && "id" in d ? String(d.id) : "",
    );
    expect(ids).toEqual([...KINETIC_LIST_VARIABLE_IDS]);
  });
});
