import { describe, expect, it } from "vitest";
import { diffLearningInputs } from "./learning-input-diff";

const m = { views: 10, likes: 1, replies: 2, reposts: 3 };
const at = new Date("2026-10-02T00:00:00Z");
const post = (id: string, publications?: (typeof m & { metricsAt: Date | null })[]) => ({ id, ...m, publications });

describe("diffLearningInputs", () => {
  it("reports nothing when publication metrics equal the post", () => {
    expect(diffLearningInputs([post("a", [{ ...m, metricsAt: at }])])).toEqual({ missing: [], changed: [] });
  });
  it("reports a post without a publication as missing", () => {
    expect(diffLearningInputs([post("a", []), post("b")]).missing).toEqual(["a", "b"]);
  });
  it("reports a publication without metricsAt as missing, not changed", () => {
    const out = diffLearningInputs([post("a", [{ ...m, views: 99, metricsAt: null }])]);
    expect(out).toEqual({ missing: ["a"], changed: [] });
  });
  it("lists every differing metric field", () => {
    const out = diffLearningInputs([post("a", [{ ...m, views: 99, reposts: 0, metricsAt: at }])]);
    expect(out.changed).toEqual([{ postId: "a", fields: ["views", "reposts"] }]);
  });
  it("treats null vs number as changed", () => {
    const out = diffLearningInputs([{ id: "a", ...m, likes: null, publications: [{ ...m, metricsAt: at }] }]);
    expect(out.changed).toEqual([{ postId: "a", fields: ["likes"] }]);
  });
});
