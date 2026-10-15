import { describe, expect, it } from "vitest";
import { queueFailures, scrubbedEnv } from "./runner-support.ts";

describe("queueFailures", () => {
  it("treats a missing brand as a failure so the run goes red", () => {
    expect(queueFailures([
      { brandSlug: "cosmicpath", postId: "p1" },
      { brandSlug: "cosmicpath-global", skipped: "brand_not_found" },
    ])).toEqual(["cosmicpath-global: brand_not_found"]);
  });

  it("accepts created and already queued posts", () => {
    expect(queueFailures([{ brandSlug: "cosmicpath", postId: "p1" }, { brandSlug: "cosmicpath-global", skipped: "already_queued" }])).toEqual([]);
  });

  it("flags a response that is not a results array", () => {
    expect(queueFailures(undefined)).toEqual(["unexpected /api/cron/promo-posts response"]);
  });
});

describe("scrubbedEnv", () => {
  it("drops secrets child processes do not need and adds overrides", () => {
    const env = scrubbedEnv({ PATH: "/bin", HOME: "/home/x", CRON_SECRET: "s", BLOB_READ_WRITE_TOKEN: "b", COSMICPATH_READ_TOKEN: "c" }, { TZ: "UTC" });
    expect(env).toEqual({ PATH: "/bin", HOME: "/home/x", TZ: "UTC" });
  });
});
