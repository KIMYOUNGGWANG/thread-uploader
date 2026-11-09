import { describe, expect, it } from "vitest";
import { DEFAULT_DISTRIBUTION_CONFIG, autoPublishAtFor, normalizeDistributionConfig, parseDistributionConfig } from "./config";

describe("distribution config", () => {
  it("defaults to every channel on with a 3-hour cancel window", () => {
    expect(parseDistributionConfig("{}")).toEqual(DEFAULT_DISTRIBUTION_CONFIG);
    expect(parseDistributionConfig("not json")).toEqual(DEFAULT_DISTRIBUTION_CONFIG);
    expect(DEFAULT_DISTRIBUTION_CONFIG.video.channels).toEqual(["youtube", "instagram", "tiktok"]);
  });

  it("keeps valid values and falls back on out-of-range ones", () => {
    const config = normalizeDistributionConfig({
      cancelWindowHours: 0,
      video: { channels: ["tiktok", "myspace", "youtube"] },
      cardNews: { enabled: false, dailyCap: 99 },
      x: { dailyCap: 2 },
    });
    expect(config.cancelWindowHours).toBe(0);
    expect(config.video.channels).toEqual(["youtube", "tiktok"]);
    expect(config.cardNews).toMatchObject({ enabled: false, dailyCap: 1 });
    expect(config.x).toEqual({ enabled: true, dailyCap: 2 });
  });

  it("reads distribution from the stored brandConfig and opens the window from completion", () => {
    const raw = JSON.stringify({ topics: ["a"], distribution: { cancelWindowHours: 5 } });
    const done = new Date("2026-11-09T00:00:00Z");
    expect(autoPublishAtFor(raw, done).toISOString()).toBe("2026-11-09T05:00:00.000Z");
  });
});
