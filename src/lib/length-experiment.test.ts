import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  classifyLength,
  countPendingByArm,
  currentArm,
  lengthGateReason,
  pickPublishCandidate,
  planExperimentRefillCount,
  planLengthArms,
  shuffleArms,
  sequencePosition,
  type ExperimentPostShape,
} from "@/lib/length-experiment";
import { parseLengthExperiment, type LengthExperimentConfig } from "@/types/length-experiment";
import { parseBrandConfig } from "@/types/brand";

const START = "2026-10-20T00:00:00.000Z";
const config: LengthExperimentConfig = { startAt: START, sequence: "LSSL", shortMax: 260, longMin: 390 };
const afterStart = new Date("2026-10-21T00:00:00.000Z");
const beforeStart = new Date("2026-10-19T00:00:00.000Z");

function draft(id: string, length: number, overrides: Partial<ExperimentPostShape> = {}): ExperimentPostShape & { id: string } {
  return { id, content: "가".repeat(length), postCategory: "GROWTH", formulaId: "concept_hierarchy", createdAt: afterStart, ...overrides };
}

describe("length experiment sequence", () => {
  it("sequence json matches the pre-registered table", () => {
    const doc = readFileSync("docs/experiments/2026-10-16-post-length.md", "utf8");
    const fromDoc = [...doc.matchAll(/^\s*\d+-\d+:\s*((?:[SL]\s*)+)$/gm)].map((match) => match[1].replace(/\s/g, "")).join("");
    const json = JSON.parse(readFileSync("scripts/length-experiment-sequence.json", "utf8")) as { sequence: string; shortMax: number; longMin: number };

    expect(json.sequence).toBe(fromDoc);
    expect(json.sequence).toHaveLength(90);
    expect([...json.sequence].filter((arm) => arm === "S")).toHaveLength(45);
    expect(json).toMatchObject({ shortMax: 260, longMin: 390 });
  });
});

describe("classifyLength", () => {
  it("classifies by the pre-registered boundaries", () => {
    expect(classifyLength("가".repeat(260), config)).toBe("S");
    expect(classifyLength("가".repeat(261), config)).toBe("MID");
    expect(classifyLength("가".repeat(389), config)).toBe("MID");
    expect(classifyLength("가".repeat(390), config)).toBe("L");
  });
});

describe("parseLengthExperiment", () => {
  it("rejects malformed config", () => {
    expect(parseLengthExperiment({ startAt: "nope", sequence: "SL" })).toBeUndefined();
    expect(parseLengthExperiment({ startAt: START, sequence: "SXL" })).toBeUndefined();
    expect(parseLengthExperiment({ startAt: START, sequence: "SL", shortMax: 400, longMin: 390 })).toBeUndefined();
    expect(parseLengthExperiment("SL")).toBeUndefined();
  });

  it("fills the pre-registered boundaries by default", () => {
    expect(parseLengthExperiment({ startAt: START, sequence: "SL" })).toEqual({ startAt: START, sequence: "SL", shortMax: 260, longMin: 390 });
  });

  it("parseBrandConfig keeps a valid lengthExperiment and drops a malformed one", () => {
    expect(parseBrandConfig(JSON.stringify({ lengthExperiment: config })).lengthExperiment).toEqual(config);
    expect(parseBrandConfig(JSON.stringify({ lengthExperiment: { startAt: START, sequence: "SXL" } })).lengthExperiment).toBeUndefined();
  });
});

describe("currentArm", () => {
  it("is null before startAt and after the sequence is used up", () => {
    expect(currentArm(config, 0, beforeStart)).toBeNull();
    expect(currentArm(config, config.sequence.length, afterStart)).toBeNull();
    expect(currentArm(config, 0, afterStart)).toBe("L");
    expect(currentArm(config, 1, afterStart)).toBe("S");
  });
});

describe("sequencePosition", () => {
  it("counts only experiment drafts with S/L length", () => {
    const published = [
      draft("s", 200),
      draft("l", 420),
      draft("mid", 300),
      draft("warmup", 200, { postCategory: "WARMUP" }),
      draft("promo", 200, { formulaId: "video:promo-x" }),
      draft("old", 200, { createdAt: beforeStart }),
    ];

    expect(sequencePosition(published, config)).toBe(2);
  });
});

describe("pickPublishCandidate", () => {
  const oldLong = draft("old-L", 420, { createdAt: beforeStart });
  const newShort = draft("new-S", 200);
  const newMid = draft("new-MID", 300);
  const newLong = draft("new-L", 420);

  it("skips mismatched, pre-start and MID drafts", () => {
    expect(pickPublishCandidate([oldLong, newShort, newMid, newLong], config, "L")?.id).toBe("new-L");
    expect(pickPublishCandidate([oldLong, newShort, newMid, newLong], config, "S")?.id).toBe("new-S");
    expect(pickPublishCandidate([oldLong, newMid, newLong], config, "S")).toBeNull();
  });

  it("lets non-experiment posts through without matching", () => {
    const warmup = draft("warmup", 420, { postCategory: "WARMUP" });
    expect(pickPublishCandidate([warmup, newLong], config, "S")?.id).toBe("warmup");
  });
});

describe("New Year posts sit the length experiment out", () => {
  const nyMid = draft("ny-MID", 300, { formulaId: "ny_monthly" });
  const nyShort = draft("ny-S", 200, { formulaId: "ny_pick" });
  const nyLong = draft("ny-L", 420, { formulaId: "ny_ranking" });

  it("publishes a MID New Year post like any non-experiment post", () => {
    expect(pickPublishCandidate([nyMid, draft("new-S", 200)], config, "S")?.id).toBe("ny-MID");
  });
  it("does not count S/L New Year posts toward the sequence or the pending arms", () => {
    expect(sequencePosition([nyShort, nyLong, draft("s", 200)], config)).toBe(1);
    expect(countPendingByArm([nyShort, nyLong], config)).toEqual({ S: 0, L: 0 });
  });
});

describe("ref_replay posts sit the length experiment out", () => {
  it("does not count ref_replay posts toward the sequence or the pending arms", () => {
    const posts = [draft("r", 200, { formulaId: "ref_replay" }), draft("c", 200)];
    expect(sequencePosition(posts, config)).toBe(1);
    expect(countPendingByArm([draft("r-L", 420, { formulaId: "ref_replay" })], config)).toEqual({ S: 0, L: 0 });
    expect(pickPublishCandidate([draft("r-L", 420, { formulaId: "ref_replay" })], config, "S")?.formulaId).toBe("ref_replay");
  });
});

describe("countPendingByArm", () => {
  it("counts only experiment drafts per arm", () => {
    const pending = [draft("a", 200), draft("b", 420), draft("c", 420), draft("d", 300), draft("e", 200, { createdAt: beforeStart })];
    expect(countPendingByArm(pending, config)).toEqual({ S: 1, L: 2 });
  });
});

describe("planLengthArms", () => {
  it("fills the scarcer arm first", () => {
    expect(planLengthArms({ S: 5, L: 0 }, "S", 3)).toEqual(["L", "L", "L"]);
    expect(planLengthArms({ S: 1, L: 1 }, "L", 2)).toEqual(["L", "S"]);
  });
});

describe("shuffleArms", () => {
  it("decouples arm order from batch index while keeping the planned counts", () => {
    expect(shuffleArms(["S", "S", "L"], () => 0)).toEqual(["S", "L", "S"]);
    expect(shuffleArms(["L", "L", "L", "S"]).filter((arm) => arm === "L")).toHaveLength(3);
  });
});

describe("planExperimentRefillCount", () => {
  it("tops each arm to half the target", () => {
    expect(planExperimentRefillCount({ S: 5, L: 0 }, 10)).toBe(5);
    expect(planExperimentRefillCount({ S: 5, L: 5 }, 10)).toBe(0);
    expect(planExperimentRefillCount({ S: 0, L: 0 }, 10)).toBe(6);
  });
});

describe("lengthGateReason", () => {
  it("passes a draft in its target band and explains a miss", () => {
    expect(lengthGateReason("가".repeat(420), "L", config)).toBeNull();
    const reason = lengthGateReason("가".repeat(300), "L", config);
    expect(reason).toContain("L 범위 밖");
    expect(reason).toContain("300자");
  });

  it("rejects an L draft over the single-post limit, since longer posts split into a thread", () => {
    expect(lengthGateReason("가".repeat(500), "L", config)).toBeNull();
    const reason = lengthGateReason("가".repeat(520), "L", config);
    expect(reason).toContain("L 범위 밖");
    expect(reason).toContain("520자");
  });
});
