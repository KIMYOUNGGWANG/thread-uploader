import type { KineticListScript } from "./kinetic-list-script";

// hyperframes/templates/kinetic-list/index.html 의 data-composition-variables 와 같은 순서·같은 집합
export const KINETIC_LIST_VARIABLE_IDS = [
  "hookSrc", "hookKind", "kicker", "hook1", "hook2", "intro1", "intro2",
  "g1", "l1", "a1a", "a1b",
  "g2", "l2", "a2a", "a2b",
  "g3", "l3", "a3a", "a3b",
  "cta1", "cta2",
] as const;

export const DEFAULT_HOOK_SRC = "assets/img/hook-default.png";

const VIDEO_EXT = /\.(mp4|webm|mov)$/i;

export function buildKineticListVariables(
  script: KineticListScript,
  hookSrc: string | null,
): Record<string, string> {
  const src = hookSrc ?? DEFAULT_HOOK_SRC;
  const vars: Record<string, string> = {
    hookSrc: src,
    // 쿼리스트링(서명 URL)이 붙어도 확장자로 판단
    hookKind: VIDEO_EXT.test(src.split(/[?#]/)[0]) ? "video" : "image",
    kicker: script.hook.kicker,
    hook1: script.hook.lines[0],
    hook2: script.hook.lines[1],
    intro1: script.intro.l1,
    intro2: script.intro.l2,
    cta1: script.cta.l1,
    cta2: script.cta.l2,
  };
  script.items.forEach((item, i) => {
    const n = i + 1;
    vars[`g${n}`] = item.glyph;
    vars[`l${n}`] = item.label;
    vars[`a${n}a`] = item.action[0];
    vars[`a${n}b`] = item.action[1];
  });
  return vars;
}
