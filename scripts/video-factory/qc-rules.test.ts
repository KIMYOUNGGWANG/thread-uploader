import { describe, expect, it } from "vitest";
import {
  QC,
  judge,
  parseBlackIntervals,
  parseDuration,
  parseMeanVolumeDb,
  parsePsnrAverage,
} from "./qc-rules.mjs";

// Real ffmpeg 7 stderr fragments (kinetic-list render, Task 5 out.mp4)
const BLACKDETECT = `frame=  315 fps=0.0 q=-0.0 size=N/A time=00:00:10.50 bitrate=N/A speed=60x
[Parsed_blackdetect_0 @ 0x7faaec4a7e40] black_start:0 black_end:0.5 black_duration:0.5
[Parsed_blackdetect_0 @ 0x7faaec4a7e40] black_start:9.2 black_end:9.4 black_duration:0.2`;
const VOLUMEDETECT = `[Parsed_volumedetect_0 @ 0x7fee8cf04f00] n_samples: 960000
[Parsed_volumedetect_0 @ 0x7fee8cf04f00] mean_volume: -34.1 dB
[Parsed_volumedetect_0 @ 0x7fee8cf04f00] max_volume: -18.6 dB`;
const NO_AUDIO = `[out#0/null @ 0x7f9153a04280] Output file does not contain any stream
Error opening output file -.`;
const CLEAN_PSNRS = [28.57, 14.11, 46.58, 14.04, 16.09, 18.7, 16.78, 41.33];
const clean = {
  checkErrors: 0,
  durationSec: 10,
  blackIntervals: [],
  meanVolumeDb: -34.1,
  framePsnrs: CLEAN_PSNRS,
};

describe("qc-rules parsers", () => {
  it("parses duration", () => {
    expect(parseDuration("10.000000\n")).toBe(10);
    expect(() => parseDuration("N/A\n")).toThrow();
  });

  it("parses blackdetect intervals", () => {
    expect(parseBlackIntervals(BLACKDETECT)).toEqual([
      { start: 0, end: 0.5, duration: 0.5 },
      { start: 9.2, end: 9.4, duration: 0.2 },
    ]);
    expect(parseBlackIntervals("frame=300 time=00:00:10.00")).toEqual([]);
  });

  it("parses mean_volume", () => {
    expect(parseMeanVolumeDb(VOLUMEDETECT)).toBe(-34.1);
  });

  it("returns null volume when missing", () => {
    expect(parseMeanVolumeDb(NO_AUDIO)).toBeNull();
  });

  it("parses psnr average, inf for identical frames", () => {
    expect(
      parsePsnrAverage("[Parsed_psnr_0 @ 0x7f] PSNR r:45.69 g:46.76 b:47.46 average:46.581902 min:46.58 max:46.58"),
    ).toBeCloseTo(46.581902);
    expect(parsePsnrAverage("[Parsed_psnr_0 @ 0x7f] PSNR r:inf g:inf b:inf average:inf min:inf max:inf")).toBe(
      Infinity,
    );
    expect(() => parsePsnrAverage("nothing")).toThrow();
  });
});

describe("qc-rules judge", () => {
  it("uses the Task 5 still threshold", () => {
    expect(QC).toEqual({ minSec: 9, maxSec: 11, maxBlackSec: 0.3, maxStillPsnr: 49.6 });
  });

  it("passes a clean 10s render", () => {
    expect(judge(clean)).toEqual({ pass: true, errors: [] });
  });

  it("fails a black first frame", () => {
    const result = judge({ ...clean, blackIntervals: [{ start: 0, end: 0.1, duration: 0.1 }] });
    expect(result.pass).toBe(false);
    expect(result.errors).toEqual([expect.stringMatching(/^black: first frame/)]);
  });

  it("fails a black stretch longer than 0.3s", () => {
    const result = judge({ ...clean, blackIntervals: [{ start: 5, end: 5.4, duration: 0.4 }] });
    expect(result.errors).toEqual([expect.stringMatching(/^black: 0.4s at 5s/)]);
    expect(judge({ ...clean, blackIntervals: [{ start: 5, end: 5.2, duration: 0.2 }] }).pass).toBe(true);
  });

  it("fails a 12s render", () => {
    const result = judge({ ...clean, durationSec: 12 });
    expect(result.pass).toBe(false);
    expect(result.errors).toEqual([expect.stringMatching(/^duration: 12s/)]);
    expect(judge({ ...clean, durationSec: Number.NaN }).pass).toBe(false);
  });

  it("fails silence", () => {
    expect(judge({ ...clean, meanVolumeDb: null }).errors).toEqual([expect.stringMatching(/^silence/)]);
    expect(judge({ ...clean, meanVolumeDb: -91 }).errors).toEqual([expect.stringMatching(/^silence/)]);
  });

  it("fails a still stretch", () => {
    const framePsnrs = [...CLEAN_PSNRS];
    framePsnrs[3] = Infinity;
    expect(judge({ ...clean, framePsnrs }).errors).toEqual(["motion: still at 3s"]);
  });

  it("ignores pairs in the last 2s end card", () => {
    expect(judge({ ...clean, framePsnrs: [...CLEAN_PSNRS, Infinity, Infinity] }).pass).toBe(true);
  });

  it("fails when check reports errors", () => {
    expect(judge({ ...clean, checkErrors: 2 }).errors).toEqual(["check: 2 errors"]);
  });
});
