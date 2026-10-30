import { afterEach, describe, expect, it, vi } from "vitest";

const create = vi.fn();
vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = { create };
  },
}));

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

  it("counts an empty (no text) response as an attempt", async () => {
    const createMessage = vi
      .fn<(p: string) => Promise<string>>()
      .mockRejectedValueOnce(new Error("Claude returned no text (stop_reason: max_tokens)"))
      .mockResolvedValueOnce(JSON.stringify(valid()));
    const result = await generateKineticListScript(input, createMessage);
    expect(result.ok).toBe(true);
    expect(createMessage).toHaveBeenCalledTimes(2);
    expect(createMessage.mock.calls[1][0]).toContain("Claude returned no text");
  });

  it("still propagates other errors (network, auth)", async () => {
    const createMessage = vi.fn(async (): Promise<string> => {
      throw new Error("401 invalid x-api-key");
    });
    await expect(generateKineticListScript(input, createMessage)).rejects.toThrow("401");
    expect(createMessage).toHaveBeenCalledTimes(1);
  });

  it("asks for Hangul day-master labels in the prompt", async () => {
    const createMessage = vi.fn<(p: string) => Promise<string>>().mockResolvedValue(JSON.stringify(valid()));
    await generateKineticListScript(input, createMessage);
    expect(createMessage.mock.calls[0][0]).toContain("label은 한글 일간 이름(예: 병화)");
  });

  it("calls the video script model without thinking", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
    create.mockResolvedValueOnce({ stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify(valid()) }] });
    const result = await generateKineticListScript(input);
    expect(result.ok).toBe(true);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ model: "claude-sonnet-5-5", max_tokens: 1500, thinking: { type: "between_tools" } }),
    );
  });

  it("tells the model how spaces count and quotes the overshooting text on retry", async () => {
    const tooLong = { ...valid(), hook: { kicker: "10월의 사주", lines: valid().hook.lines } };
    const createMessage = vi.fn().mockResolvedValueOnce(JSON.stringify(tooLong)).mockResolvedValueOnce(JSON.stringify(valid()));
    await generateKineticListScript(input, createMessage);
    expect(createMessage.mock.calls[0][0]).toContain("공백·쉼표·물음표도 1자로 센다");
    expect(createMessage.mock.calls[1][0]).toContain('hook.kicker: "10월의 사주" 7자 > 6자');
  });

  it("hands the previous script back so a retry repairs only the failing fields", async () => {
    const tooLong = { ...valid(), hook: { kicker: "10월의 사주", lines: valid().hook.lines } };
    const createMessage = vi.fn().mockResolvedValueOnce(JSON.stringify(tooLong)).mockResolvedValueOnce(JSON.stringify(valid()));
    await generateKineticListScript(input, createMessage);
    expect(createMessage.mock.calls[0][0]).not.toContain("직전 원고");
    expect(createMessage.mock.calls[1][0]).toContain("오류가 난 칸만 고치고");
    expect(createMessage.mock.calls[1][0]).toContain(JSON.stringify(tooLong));
  });

  it("uses a fallback script when no API key and no createMessage", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    const result = await generateKineticListScript(input);
    expect(result.ok).toBe(true);
    if (result.ok) expect(FALLBACK_SCRIPTS).toContainEqual(result.script);
  });

  it("warns once in production when falling back for a missing API key", async () => {
    vi.resetModules();
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    vi.stubEnv("NODE_ENV", "production");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { generateKineticListScript: generate } = await import("./generate-kinetic-list");
    await generate(input);
    await generate(input);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("ANTHROPIC_API_KEY"));
    warn.mockRestore();
  });

  it("does not warn outside production", async () => {
    vi.resetModules();
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    vi.stubEnv("NODE_ENV", "test");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { generateKineticListScript: generate } = await import("./generate-kinetic-list");
    await generate(input);
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
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
