import { isRecord } from "@/types/config-normalizers";
import { ChannelApiError, downloadMedia, num, requestJson, str } from "../http";
import type { ChannelAdapter, ChannelMetrics, StepResult, UploadJob } from "./types";

const API = "https://open.tiktokapis.com/v2";
const TITLE_MAX = 2200;
const POLL_MS = 60_000;

function dataOf(stage: string, response: unknown): Record<string, unknown> {
  // TikTok returns HTTP 200 with error.code !== "ok" for some failures.
  const error = isRecord(response) && isRecord(response.error) ? response.error : null;
  if (error && typeof error.code === "string" && error.code !== "ok") {
    throw new ChannelApiError(`${stage}: ${error.code}${typeof error.message === "string" ? ` ${error.message}` : ""}`, null, true);
  }
  return isRecord(response) && isRecord(response.data) ? response.data : {};
}

/**
 * Unaudited TikTok apps may only post SELF_ONLY. Use the most private option the creator allows,
 * unless the job asks for public and the creator offers PUBLIC_TO_EVERYONE.
 */
export function pickTikTokPrivacy(options: unknown, wantPublic: boolean): string {
  const list = Array.isArray(options) ? options.filter((o): o is string => typeof o === "string") : [];
  if (wantPublic && list.includes("PUBLIC_TO_EVERYONE")) return "PUBLIC_TO_EVERYONE";
  if (list.includes("SELF_ONLY") || list.length === 0) return "SELF_ONLY";
  return list[list.length - 1];
}

async function readStatus(job: UploadJob, accessToken: string): Promise<StepResult> {
  const publishId = str(job.platformData.publishId);
  if (!publishId) throw new ChannelApiError("TikTok status: missing publishId", null, true);
  const data = dataOf("TikTok status", await requestJson("TikTok status", `${API}/post/publish/status/fetch/`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json; charset=UTF-8" },
    body: JSON.stringify({ publish_id: publishId }),
  }));
  const status = str(data.status);
  if (status === "FAILED") throw new ChannelApiError(`TikTok publish failed: ${str(data.fail_reason) ?? "unknown reason"}`, null, true);
  if (status === "PUBLISH_COMPLETE" || status === "SEND_TO_USER_INBOX") {
    // Private posts have no public id; keep the publish id so the record still points at something.
    const ids = Array.isArray(data.publicaly_available_post_id) ? data.publicaly_available_post_id : [];
    const postId = ids.length > 0 ? String(ids[0]) : null;
    return {
      state: "published",
      externalId: postId ?? publishId,
      externalUrl: postId ? `https://www.tiktok.com/video/${postId}` : null,
      platformData: { ...job.platformData, publishStatus: status, publicPostId: postId },
    };
  }
  return { state: "processing", platformData: { ...job.platformData, publishStatus: status }, retryAfterMs: POLL_MS };
}

export const tiktokAdapter: ChannelAdapter = {
  kinds: ["video"],
  async start(job, creds) {
    const videoUrl = job.mediaUrls[0];
    if (!videoUrl) throw new ChannelApiError("TikTok upload: no video URL", null, true);
    const headers = { Authorization: `Bearer ${creds.accessToken}`, "Content-Type": "application/json; charset=UTF-8" };

    const creator = dataOf("TikTok creator info", await requestJson("TikTok creator info", `${API}/post/publish/creator_info/query/`, {
      method: "POST",
      headers,
    }));
    const privacy = pickTikTokPrivacy(creator.privacy_level_options, job.privacy === "public");

    const video = await downloadMedia(videoUrl, 64 * 1024 * 1024);
    const init = dataOf("TikTok init", await requestJson("TikTok init", `${API}/post/publish/video/init/`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        post_info: {
          title: job.caption.slice(0, TITLE_MAX),
          privacy_level: privacy,
          disable_comment: false,
          disable_duet: false,
          disable_stitch: false,
        },
        // Files under 64MB go up as a single chunk.
        source_info: { source: "FILE_UPLOAD", video_size: video.byteLength, chunk_size: video.byteLength, total_chunk_count: 1 },
      }),
    }));
    const publishId = str(init.publish_id);
    const uploadUrl = str(init.upload_url);
    if (!publishId || !uploadUrl) throw new ChannelApiError("TikTok init: response has no publish_id/upload_url");

    const put = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": "video/mp4",
        "Content-Length": String(video.byteLength),
        "Content-Range": `bytes 0-${video.byteLength - 1}/${video.byteLength}`,
      },
      body: video,
      signal: AbortSignal.timeout(120_000),
    });
    if (!put.ok) throw new ChannelApiError(`TikTok upload: HTTP ${put.status}`, put.status);

    return { state: "processing", platformData: { publishId, privacyLevel: privacy }, retryAfterMs: POLL_MS };
  },
  poll: (job, creds) => readStatus(job, creds.accessToken),
  async metrics(externalIds, creds) {
    const out: ChannelMetrics[] = [];
    for (let i = 0; i < externalIds.length; i += 20) {
      const data = dataOf("TikTok video query", await requestJson(
        "TikTok video query",
        `${API}/video/query/?fields=id,view_count,like_count,comment_count,share_count`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${creds.accessToken}`, "Content-Type": "application/json; charset=UTF-8" },
          body: JSON.stringify({ filters: { video_ids: externalIds.slice(i, i + 20) } }),
        },
      ));
      const videos = Array.isArray(data.videos) ? data.videos : [];
      for (const v of videos) {
        if (!isRecord(v) || !str(v.id)) continue;
        out.push({ externalId: v.id as string, views: num(v.view_count), likes: num(v.like_count), comments: num(v.comment_count), shares: num(v.share_count) });
      }
    }
    return out;
  },
};
