import { afterEach, describe, expect, it, vi } from "vitest";
import { FALLBACK_SCRIPTS, generateKineticListScript, SCRIPT_SCHEMA } from "./generate-kinetic-list";
import { checkKineticListScript, forbiddenTermsFor } from "./kinetic-list-script";

const input = { brandName: "cosmicpath", qualityProfile: "saju_viral", recentHooks: ["지난 훅"], kstDate: "2026-10-30" };

const valid = () => structuredClone(FALLBACK_SCRIPTS[0]);
const tooLong = () => {
  const s = valid();
  s.hook.lines[1] = "아홉글자아홉글자아";
  return s;
};

afterEach(() => vi.unstubAllEnvs());

describe("generateKineticListScript", () => {
  it("retries with the previous errors and returns the second valid script", async () => {
    const createMessage = vi
      .fn<(p: string) => Promise<string>>()
      .mockResolvedValueOnce(JSON.stringify(tooLong()))
      .mockResolvedValueOnce(`설명 ${JSON.stringify(valid())} 끝`);
    const result = await generateKineticListScript(input, createMessage);
    expect(result.ok).toBe(true);
    expect(createMessage).toHaveBeenCalledTimes(2);
    expect(createMessage.mock.calls[1][0]).toContain("hook.lines");
    expect(createMessage.mock.calls[0][0]).toContain("지난 훅");
  });

  it("gives up after three invalid attempts", async () => {
    const createMessage = vi.fn(async () => JSON.stringify(tooLong()));
    const result = await generateKineticListScript(input, createMessage);
    expect(result.ok).toBe(false);
    expect(createMessage).toHaveBeenCalledTimes(3);
  });

  it("counts unparseable JSON as an attempt", async () => {
    const createMessage = vi
      .fn<(p: string) => Promise<string>>()
      .mockResolvedValueOnce("no json")
      .mockResolvedValueOnce(JSON.stringify(valid()));
    const result = await generateKineticListScript(input, createMessage);
    expect(result.ok).toBe(true);
    expect(createMessage).toHaveBeenCalledTimes(2);
  });

  it("uses a fallback script when no API key and no createMessage", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    const result = await generateKineticListScript(input);
    expect(result.ok).toBe(true);
    if (result.ok) expect(FALLBACK_SCRIPTS).toContainEqual(result.script);
  });

  it("every fallback script passes the check", () => {
    expect(FALLBACK_SCRIPTS.length).toBeGreaterThanOrEqual(2);
    for (const script of FALLBACK_SCRIPTS) {
      expect(checkKineticListScript(script, forbiddenTermsFor("saju_viral")).ok).toBe(true);
    }
  });
});

describe("SCRIPT_SCHEMA", () => {
  it("avoids array size keywords the API does not support", () => {
    const bad: string[] = [];
    const walk = (node: unknown, path: string): void => {
      if (Array.isArray(node)) return node.forEach((v, i) => walk(v, `${path}[${i}]`));
      if (typeof node !== "object" || node === null) return;
      for (const [k, v] of Object.entries(node)) {
        if (k === "maxItems" || (k === "minItems" && typeof v === "number" && v > 1)) bad.push(`${path}.${k}`);
        walk(v, `${path}.${k}`);
      }
    };
    walk(SCRIPT_SCHEMA, "schema");
    expect(bad).toEqual([]);
  });
});
