import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const create = vi.fn();
vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = { create };
  },
}));

import { judgeEnglishNaturalness, parseNaturalnessVerdict } from "@/lib/english-naturalness";

const POST = "Is your birth hour actually wrong, instead?";

describe("parseNaturalnessVerdict", () => {
  it("parses a JSON verdict", () => {
    expect(
      parseNaturalnessVerdict('{"natural": false, "reason": "\\"actually wrong, instead\\" stacks two hedges"}')
    ).toEqual({ natural: false, reason: '"actually wrong, instead" stacks two hedges' });
  });

  it("extracts JSON wrapped in prose or a code fence", () => {
    expect(parseNaturalnessVerdict('Here you go:\n```json\n{"natural": false, "reason": "calque"}\n```')).toEqual({
      natural: false,
      reason: "calque",
    });
  });

  it("gives a flagged verdict without a reason an actionable fallback reason", () => {
    expect(parseNaturalnessVerdict('{"natural": false, "reason": ""}')).toEqual({ natural: false, reason: "awkward phrasing" });
    expect(parseNaturalnessVerdict('{"natural": false}')).toEqual({ natural: false, reason: "awkward phrasing" });
  });

  it("treats unparseable output as natural", () => {
    expect(parseNaturalnessVerdict("sure!").natural).toBe(true);
    expect(parseNaturalnessVerdict('{"natural": "no"}').natural).toBe(true);
    expect(parseNaturalnessVerdict("{broken}").natural).toBe(true);
  });
});

describe("judgeEnglishNaturalness", () => {
  const savedKey = process.env.ANTHROPIC_API_KEY;
  beforeEach(() => {
    create.mockReset();
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
    if (savedKey === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = savedKey;
  });

  it("passes without an API key", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    expect((await judgeEnglishNaturalness(POST)).natural).toBe(true);
    expect(create).not.toHaveBeenCalled();
  });

  it("passes when the API call fails", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    create.mockRejectedValue(new Error("boom"));
    expect(await judgeEnglishNaturalness(POST)).toEqual({ natural: true, reason: "" });
  });

  it("passes when the model refuses", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    create.mockResolvedValue({ stop_reason: "refusal", content: [] });
    expect((await judgeEnglishNaturalness(POST)).natural).toBe(true);
  });

  it("returns the model's verdict", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    create.mockResolvedValue({
      stop_reason: "end_turn",
      content: [{ type: "text", text: '{"natural": false, "reason": "stacked hedges"}' }],
    });
    expect(await judgeEnglishNaturalness(POST)).toEqual({ natural: false, reason: "stacked hedges" });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ max_tokens: 300, thinking: { type: "disabled" }, output_config: { effort: "low" } })
    );
  });

  it("tells the judge the A)/B) closing and the closing question are required format", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    create.mockResolvedValue({ stop_reason: "end_turn", content: [{ type: "text", text: '{"natural": true, "reason": ""}' }] });
    await judgeEnglishNaturalness(POST);
    const prompt: unknown = create.mock.calls[0]?.[0]?.messages?.[0]?.content;
    expect(typeof prompt).toBe("string");
    expect(prompt).toContain('"A) "');
    expect(prompt).toContain('"B) "');
    expect(prompt).toContain("Which one are you?");
    expect(prompt).toContain("required format");
    expect(prompt).toMatch(/romanized Korean/i);
    expect(prompt).toContain("when unsure, answer natural");
  });
});
