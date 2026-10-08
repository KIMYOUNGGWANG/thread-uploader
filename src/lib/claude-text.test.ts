import { describe, expect, it } from "vitest";
import { readMessageText } from "./claude-text";

describe("readMessageText", () => {
  it("skips leading thinking blocks and returns the text", () => {
    const text = readMessageText({
      stop_reason: "end_turn",
      content: [
        { type: "thinking", thinking: "", signature: "sig" },
        { type: "text", text: " Hello world ", citations: null },
      ],
    });
    expect(text).toBe("Hello world");
  });

  it("throws on refusal and on empty text", () => {
    expect(() => readMessageText({ stop_reason: "refusal", content: [] })).toThrow(/refusal/);
    expect(() => readMessageText({ stop_reason: "max_tokens", content: [{ type: "thinking", thinking: "", signature: "s" }] })).toThrow(/no text/);
  });
});
