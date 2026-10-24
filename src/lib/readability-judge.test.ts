import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const create = vi.fn();
vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = { create };
  },
}));

import { judgeReadability, parseReadabilityVerdict } from "@/lib/readability-judge";

describe("parseReadabilityVerdict", () => {
  it("fails when any of the three answers is no", () => {
    expect(
      parseReadabilityVerdict('{"keepReading": true, "understandable": false, "takeaway": true, "reason": "재성·겁재 풀이 없음"}')
    ).toEqual({ readable: false, reason: "재성·겁재 풀이 없음" });
    expect(parseReadabilityVerdict('{"keepReading": false, "understandable": true, "takeaway": true, "reason": "첫 줄이 약함"}').readable).toBe(false);
    expect(parseReadabilityVerdict('{"keepReading": true, "understandable": true, "takeaway": false, "reason": "남는 게 없음"}').readable).toBe(false);
  });

  it("passes when all three are yes", () => {
    expect(parseReadabilityVerdict('{"keepReading": true, "understandable": true, "takeaway": true, "reason": ""}').readable).toBe(true);
  });

  it("extracts JSON wrapped in a code fence", () => {
    expect(
      parseReadabilityVerdict('```json\n{"keepReading": true, "understandable": false, "takeaway": true, "reason": "용어"}\n```')
    ).toEqual({ readable: false, reason: "용어" });
  });

  it("gives a failing verdict without a reason an actionable fallback", () => {
    expect(parseReadabilityVerdict('{"keepReading": true, "understandable": false, "takeaway": true}')).toEqual({
      readable: false,
      reason: "사주를 모르는 독자가 읽기 어려움",
    });
  });

  it("treats unparseable output as readable", () => {
    expect(parseReadabilityVerdict("네!").readable).toBe(true);
    expect(parseReadabilityVerdict('{"keepReading": "no", "understandable": true, "takeaway": true}').readable).toBe(true);
    expect(parseReadabilityVerdict('{"keepReading": true}').readable).toBe(true);
    expect(parseReadabilityVerdict("{broken}").readable).toBe(true);
  });
});

describe("judgeReadability", () => {
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
    expect((await judgeReadability("본문", "댓글")).readable).toBe(true);
    expect(create).not.toHaveBeenCalled();
  });

  it("passes when the API call fails", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    create.mockRejectedValue(new Error("boom"));
    expect(await judgeReadability("본문", "댓글")).toEqual({ readable: true, reason: "" });
  });

  it("passes when the model refuses", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    create.mockResolvedValue({ stop_reason: "refusal", content: [] });
    expect((await judgeReadability("본문", "댓글")).readable).toBe(true);
  });

  it("returns the model's verdict with the Task 8 client settings", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    create.mockResolvedValue({
      stop_reason: "end_turn",
      content: [{ type: "text", text: '{"keepReading": true, "understandable": false, "takeaway": true, "reason": "비겁 설명 없음"}' }],
    });
    expect(await judgeReadability("본문", "댓글")).toEqual({ readable: false, reason: "비겁 설명 없음" });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ max_tokens: 300, thinking: { type: "disabled" }, output_config: { effort: "low" } })
    );
  });

  it("sends body and first comment under separate labels and names the allowed formats", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    create.mockResolvedValue({
      stop_reason: "end_turn",
      content: [{ type: "text", text: '{"keepReading": true, "understandable": true, "takeaway": true, "reason": ""}' }],
    });
    await judgeReadability("BODY_TEXT_X", "COMMENT_TEXT_Y");
    const prompt: unknown = create.mock.calls[0]?.[0]?.messages?.[0]?.content;
    expect(typeof prompt).toBe("string");
    const text = prompt as string;
    expect(text).toContain("[본문]");
    expect(text).toContain("[첫 댓글]");
    expect(text.indexOf("[본문]")).toBeLessThan(text.indexOf("BODY_TEXT_X"));
    expect(text.indexOf("[첫 댓글]")).toBeLessThan(text.indexOf("COMMENT_TEXT_Y"));
    expect(text).toContain("1/2/3 또는 A/B/C");
    expect(text).toContain("닫는 질문");
    expect(text).toContain("사주 용어는 많아야 하나");
    expect(text).toContain("확실할 때만 아니오");
  });
});
