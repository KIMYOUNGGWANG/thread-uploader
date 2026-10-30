// Quality gate for video-factory renders (design spec 5.4). Pure functions over ffmpeg/ffprobe text output,
// shared by the CI runner (video/scripts/factory-job.mjs) and its unit tests.

/** maxStillPsnr: Task 5 style-sample render peaked at 46.58 dB (2-3s) + 3 dB. Above it, two frames 1s apart are "the same". */
export const QC = { minSec: 9, maxSec: 11, maxBlackSec: 0.3, maxStillPsnr: 49.6 };

/** Last 2s are the end card, which holds still by design (spec ch.3). */
const JUDGED_PSNR_PAIRS = 8;

/** @param {string} ffprobeOut `ffprobe -show_entries format=duration -of default=nw=1:nk=1` output @returns {number} */
export function parseDuration(ffprobeOut) {
  const seconds = Number.parseFloat(ffprobeOut.trim());
  if (!Number.isFinite(seconds)) throw new Error(`unreadable duration: ${ffprobeOut.trim()}`);
  return seconds;
}

/** @param {string} stderr blackdetect stderr @returns {{start: number, end: number, duration: number}[]} */
export function parseBlackIntervals(stderr) {
  return [...stderr.matchAll(/black_start:([\d.]+) black_end:([\d.]+) black_duration:([\d.]+)/g)].map((m) => ({
    start: Number(m[1]),
    end: Number(m[2]),
    duration: Number(m[3]),
  }));
}

/** @param {string} stderr volumedetect stderr @returns {number | null} null when there is no audio stream */
export function parseMeanVolumeDb(stderr) {
  const match = stderr.match(/mean_volume: (-?[\d.]+|-inf) dB/);
  if (!match) return null;
  return match[1] === "-inf" ? -Infinity : Number(match[1]);
}

/** @param {string} stderr `-lavfi psnr` stderr @returns {number} Infinity for identical frames */
export function parsePsnrAverage(stderr) {
  const match = stderr.match(/average:(inf|[\d.]+)/);
  if (!match) throw new Error("psnr output has no average");
  return match[1] === "inf" ? Infinity : Number(match[1]);
}

/**
 * @param {{ checkErrors: number, durationSec: number, blackIntervals: {start: number, end: number, duration: number}[],
 *           meanVolumeDb: number | null, framePsnrs: number[] }} m framePsnrs[i] = PSNR of frames at i s and i+1 s
 * @returns {{ pass: boolean, errors: string[] }}
 */
export function judge({ checkErrors, durationSec, blackIntervals, meanVolumeDb, framePsnrs }) {
  const errors = [];
  if (checkErrors > 0) errors.push(`check: ${checkErrors} errors`);
  if (!(durationSec >= QC.minSec && durationSec <= QC.maxSec)) {
    errors.push(`duration: ${durationSec}s outside ${QC.minSec}-${QC.maxSec}s`);
  }
  for (const b of blackIntervals) {
    if (b.start < 0.05) errors.push(`black: first frame (${b.duration}s)`);
    else if (b.duration > QC.maxBlackSec) errors.push(`black: ${b.duration}s at ${b.start}s`);
  }
  if (meanVolumeDb === null) errors.push("silence: no audio stream");
  else if (meanVolumeDb < -60) errors.push(`silence: mean_volume ${meanVolumeDb} dB`);
  framePsnrs.slice(0, JUDGED_PSNR_PAIRS).forEach((psnr, i) => {
    if (psnr > QC.maxStillPsnr) errors.push(`motion: still at ${i}s`);
  });
  return { pass: errors.length === 0, errors };
}
