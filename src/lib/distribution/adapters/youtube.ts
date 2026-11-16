import { isRecord } from "@/types/config-normalizers";
import { ChannelApiError, downloadMedia, num, readApiErrorMessage, REQUEST_TIMEOUT_MS, requestJson, str } from "../http";
import type { ChannelAdapter, ChannelMetrics, StepResult, UploadJob } from "./types";

const UPLOAD_URL = "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status";
const TITLE_MAX = 100;
const SHORTS_TAG = "#Shorts";

/** Shorts title: first caption line, trimmed to fit with #Shorts. Description keeps the whole caption. */
export function buildYouTubeMetadata(caption: string): { title: string; description: string; tags: string[] } {
  const lines = caption.split("\n").map((l) => l.trim()).filter(Boolean);
  const first = (lines[0] ?? "").replace(/#\S+/g, "").trim() || "Shorts";
  const room = TITLE_MAX - SHORTS_TAG.length - 1;
  const title = `${first.length > room ? `${first.slice(0, room - 1).trimEnd()}…` : first} ${SHORTS_TAG}`;
  const tags = [...new Set((caption.match(/#[^\s#]+/g) ?? []).map((t) => t.slice(1)))].slice(0, 15);
  return { title, description: caption.slice(0, 4900), tags };
}

function downloadVideo(job: UploadJob) {
  const videoUrl = job.mediaUrls[0];
  if (!videoUrl) throw new ChannelApiError("YouTube upload: no video URL", null, true);
  return downloadMedia(videoUrl);
}

/**
 * Reads a resumable-session reply: 200/201 = done (video resource), 308 = bytes still missing (null).
 * https://developers.google.com/youtube/v3/guides/using_resumable_upload_protocol
 */
async function readSession(stage: string, response: Response): Promise<StepResult | null> {
  if (response.status === 308) return null;
  const data: unknown = await response.json().catch(() => null);
  if (response.ok) {
    const id = isRecord(data) ? str(data.id) : null;
    if (!id) throw new ChannelApiError(`${stage}: response has no video id`);
    return { state: "published", externalId: id, externalUrl: `https://www.youtube.com/shorts/${id}` };
  }
  // 404/410: the session expired, open a new one. 5xx/429: try again later. Other 4xx: YouTube refused it.
  const gone = response.status === 404 || response.status === 410;
  const transient = response.status >= 500 || response.status === 429;
  throw new ChannelApiError(`${stage}: ${readApiErrorMessage(data)} (HTTP ${response.status})`, response.status, !gone && !transient, gone);
}

export const youtubeAdapter: ChannelAdapter = {
  kinds: ["video"],
  /** Opens the upload session only. The runner saves `location` before any byte goes out, so a retry resumes it instead of uploading twice. */
  async start(job: UploadJob, creds) {
    const video = await downloadVideo(job);
    const { title, description, tags } = buildYouTubeMetadata(job.caption);

    const init = await fetch(UPLOAD_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${creds.accessToken}`,
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Type": "video/mp4",
        "X-Upload-Content-Length": String(video.byteLength),
      },
      body: JSON.stringify({
        snippet: { title, description, tags, categoryId: "22" },
        status: { privacyStatus: job.privacy === "private" ? "private" : "public", selfDeclaredMadeForKids: false },
      }),
      signal: AbortSignal.timeout(30_000),
    });
    const location = init.headers.get("location");
    if (!init.ok || !location) {
      const data: unknown = await init.json().catch(() => null);
      throw new ChannelApiError(`YouTube upload init: ${readApiErrorMessage(data)} (HTTP ${init.status})`, init.status, init.status === 400 || init.status === 403);
    }
    return { state: "processing", platformData: { location, size: video.byteLength }, retryAfterMs: 0 };
  },
  /** Asks the session how far it got, then sends only the missing bytes. A lost reply is answered by the next status check. */
  async poll(job, creds) {
    const location = str(job.platformData.location);
    const size = num(job.platformData.size);
    if (!location || !size) throw new ChannelApiError("YouTube upload: no upload session", null, false, true);
    const put = (headers: Record<string, string>, body?: Uint8Array<ArrayBuffer>) =>
      fetch(location, {
        method: "PUT",
        headers: { Authorization: `Bearer ${creds.accessToken}`, ...headers },
        body,
        redirect: "manual",
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });

    const status = await put({ "Content-Range": `bytes */${size}` });
    const done = await readSession("YouTube upload status", status);
    if (done) return done;

    const received = status.headers.get("range")?.match(/^bytes=0-(\d+)$/);
    const from = received ? Number(received[1]) + 1 : 0;
    const video = await downloadVideo(job);
    if (video.byteLength !== size) throw new ChannelApiError("YouTube upload: video file changed since the session opened", null, false, true);
    const sent = await put({ "Content-Type": "video/mp4", "Content-Range": `bytes ${from}-${size - 1}/${size}` }, video.subarray(from));
    return (await readSession("YouTube upload", sent)) ?? { state: "processing", platformData: job.platformData, retryAfterMs: 0 };
  },
  async metrics(externalIds, creds) {
    const out: ChannelMetrics[] = [];
    for (let i = 0; i < externalIds.length; i += 50) {
      const ids = externalIds.slice(i, i + 50).join(",");
      const data = await requestJson("YouTube statistics", `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${encodeURIComponent(ids)}`, {
        headers: { Authorization: `Bearer ${creds.accessToken}` },
      });
      const items = isRecord(data) && Array.isArray(data.items) ? data.items : [];
      for (const item of items) {
        if (!isRecord(item) || !str(item.id)) continue;
        const stats = isRecord(item.statistics) ? item.statistics : {};
        out.push({ externalId: item.id as string, views: num(stats.viewCount), likes: num(stats.likeCount), comments: num(stats.commentCount), shares: null });
      }
    }
    return out;
  },
};
