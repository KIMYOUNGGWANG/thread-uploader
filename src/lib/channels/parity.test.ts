import { describe, expect, it } from "vitest";
import { comparePublication } from "./parity";
import type { PublicationMirror } from "./publication-mirror";

function mirror(over: Partial<PublicationMirror> = {}): PublicationMirror {
  return {
    status: "PUBLISHED", externalId: "t1", publishedAt: null, platformData: {}, attempts: 0,
    errorLog: null, views: null, likes: null, replies: null, reposts: null, metricsAt: null, ...over,
  };
}

describe("comparePublication", () => {
  it("reports nothing when the mirror matches", () =>
    expect(comparePublication(mirror({ status: "PUBLISHED", externalId: "t1", views: 5 }), { status: "PUBLISHED", externalId: "t1", views: 5 })).toEqual([]));
  it("reports nothing when neither side exists", () => expect(comparePublication(null, null)).toEqual([]));
  it("reports a missing mirror row", () => expect(comparePublication(mirror({ status: "PUBLISHED" }), null)).toEqual(["missing publication"]));
  it("reports drifted views", () =>
    expect(comparePublication(mirror({ views: 5 }), { status: "PUBLISHED", externalId: "t1", views: 4 })).toEqual(["views 5 != 4"]));
  it("reports drifted status and externalId", () =>
    expect(comparePublication(mirror({ status: "FAILED", externalId: "a" }), { status: "PUBLISHED", externalId: null, views: null })).toEqual([
      "status FAILED != PUBLISHED", "externalId a != null",
    ]));
  it("reports a stray row when no mirror is expected", () =>
    expect(comparePublication(null, { status: "PUBLISHED", externalId: "t1", views: null })).toEqual(["unexpected publication"]));
});
