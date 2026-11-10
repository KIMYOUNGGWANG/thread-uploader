import { isRecord } from "@/types/config-normalizers";
import { ChannelApiError, downloadMedia, num, readApiErrorMessage, requestJson, str } from "../http";
import type { ChannelAdapter, ChannelMetrics, UploadJob } from "./types";

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

export const youtubeAdapter: ChannelAdapter = {
  kinds: ["video"],
  async start(job: UploadJob, creds) {
    const videoUrl = job.mediaUrls[0];
    if (!videoUrl) throw new ChannelApiError("YouTube upload: no video URL", null, true);
    const video = await downloadMedia(videoUrl);
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

    const data = await requestJson("YouTube upload", location, {
      method: "PUT",
      headers: { "Content-Type": "video/mp4", "Content-Length": String(video.byteLength) },
      body: video,
    });
    const id = isRecord(data) ? str(data.id) : null;
    if (!id) throw new ChannelApiError("YouTube upload: response has no video id");
    return { state: "published", externalId: id, externalUrl: `https://www.youtube.com/shorts/${id}` };
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
