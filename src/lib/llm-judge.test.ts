import { describe, expect, it } from "vitest";
import { extractJsonObject } from "@/lib/llm-judge";

describe("extractJsonObject", () => {
  it("parses an object, including one wrapped in prose or a code fence", () => {
    expect(extractJsonObject('{"a": 1}')).toEqual({ a: 1 });
    expect(extractJsonObject('Here:\n```json\n{"a": "b"}\n```')).toEqual({ a: "b" });
  });

  it("returns null for non-JSON, arrays and primitives", () => {
    expect(extractJsonObject("네!")).toBeNull();
    expect(extractJsonObject("[1, 2]")).toBeNull();
    expect(extractJsonObject("null")).toBeNull();
    expect(extractJsonObject("42")).toBeNull();
  });

  it("returns null for broken JSON", () => {
    expect(extractJsonObject("{broken}")).toBeNull();
  });
});
