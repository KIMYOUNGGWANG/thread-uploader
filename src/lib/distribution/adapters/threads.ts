import { classifyThreadsError, fetchContainerStatus, threadsErrorDetail } from "@/lib/threads-api";
import { getThreadsContentLimitError } from "@/lib/threads-limits";
import { isRecord } from "@/types/config-normalizers";
import { ChannelApiError, REQUEST_TIMEOUT_MS, str } from "../http";
import type { ChannelCredentials } from "../accounts";
import type { ChannelAdapter, StepResult, UploadJob } from "./types";

const BASE = "https://graph.threads.net/v1.0";
const CAROUSEL_MAX = 10;

// ponytail: container create/publish duplicates ~20 lines of threads-api publishPostWithCredentials, which creates
// and publishes in one call and so cannot be retried safely; fold them together if that function is ever split.
async function post(stage: string, path: string, params: Record<string, string>, token: string): Promise<Record<string, unknown>> {
  const query = new URLSearchParams({ ...params, access_token: token });
  const response = await fetch(`${BASE}/${path}?${query}`, { method: "POST", signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok || !isRecord(data)) throw new Error(`[${stage}] ${threadsErrorDetail(isRecord(data) ? data : undefined)} (HTTP ${response.status})`);
  return data;
}

function account(creds: ChannelCredentials) {
  if (!creds.externalUserId) throw new ChannelApiError("Threads: no user id (reconnect needed)", null, true);
  return { userId: creds.externalUserId, token: creds.accessToken };
}

/** Before anything is published, a failed create is harmless: only token/permission/bad-input errors are permanent. */
function createError(error: unknown): ChannelApiError {
  const message = error instanceof Error ? error.message : String(error);
  const kind = classifyThreadsError(message);
  return new ChannelApiError(`Threads: ${message}`, null, kind === "token-expired" || kind === "restricted" || kind === "bad-request");
}

async function createContainer(job: UploadJob, creds: ChannelCredentials): Promise<string> {
  const { userId, token } = account(creds);
  const images = job.mediaUrls;
  try {
    if (images.length === 0) {
      return String((await post("Container", `${userId}/threads`, { media_type: "TEXT", text: job.caption }, token)).id);
    }
    if (images.length === 1) {
      return String((await post("Container", `${userId}/threads`, { media_type: "IMAGE", image_url: images[0], text: job.caption }, token)).id);
    }
    const children: string[] = [];
    for (const url of images) {
      children.push(String((await post("CarouselItem", `${userId}/threads`, { media_type: "IMAGE", image_url: url, is_carousel_item: "true" }, token)).id));
    }
    return String((await post("Carousel", `${userId}/threads`, { media_type: "CAROUSEL", children: children.join(","), text: job.caption }, token)).id);
  } catch (error) {
    throw createError(error);
  }
}

async function permalinkOf(mediaId: string, token: string): Promise<string | null> {
  try {
    const query = new URLSearchParams({ fields: "permalink", access_token: token });
    const response = await fetch(`${BASE}/${mediaId}?${query}`, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    const data: unknown = await response.json().catch(() => null);
    return isRecord(data) ? str(data.permalink) : null;
  } catch {
    return null; // already published; a missing link must not fail or retry the upload
  }
}

/**
 * Publishes a finished container. The status is read first on every poll, so a poll that runs again after a
 * crash or lost response sees PUBLISHED and stops instead of posting twice. After the publish call left,
 * only a rate-limit error ("retry") is retried; anything else is "delivery uncertain" for a human to check.
 */
async function publishWhenReady(job: UploadJob, creds: ChannelCredentials): Promise<StepResult> {
  const { userId, token } = account(creds);
  const containerId = str(job.platformData.containerId);
  if (!containerId) throw new ChannelApiError("Threads: missing containerId", null, true);
  const status = await fetchContainerStatus(containerId, token); // a failed check throws a plain Error: poll again later
  if (status === "PUBLISHED") {
    // ponytail: the container id stands in for the media id when the publish response was lost
    const mediaId = str(job.platformData.mediaId) ?? containerId;
    return { state: "published", externalId: mediaId, externalUrl: null, platformData: job.platformData };
  }
  if (status === "ERROR" || status === "EXPIRED") throw new ChannelApiError(`Threads container ${status}`, null, false, true);
  if (status !== "FINISHED") return { state: "processing", platformData: job.platformData, retryAfterMs: 5000 };

  let mediaId: string;
  try {
    mediaId = String((await post("Publish", `${userId}/threads_publish`, { creation_id: containerId }, token)).id);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (classifyThreadsError(message) === "retry") throw new ChannelApiError(`Threads: ${message}`, 429, false);
    throw new ChannelApiError(`Threads: 전송 여부 확인 필요 (${message}) — 계정을 확인해줘`, null, true);
  }
  return { state: "published", externalId: mediaId, externalUrl: await permalinkOf(mediaId, token), platformData: { ...job.platformData, mediaId } };
}

export const threadsAdapter: ChannelAdapter = {
  kinds: ["post"],
  async start(job, creds): Promise<StepResult> {
    const lengthError = getThreadsContentLimitError(job.caption, { allowMultiPart: false });
    if (lengthError) throw new ChannelApiError(`Threads: ${lengthError}`, null, true);
    if (job.mediaUrls.length > CAROUSEL_MAX) throw new ChannelApiError(`Threads: 이미지는 ${CAROUSEL_MAX}장까지야`, null, true);
    const containerId = await createContainer(job, creds);
    return { state: "processing", platformData: { containerId }, retryAfterMs: 3000 };
  },
  poll: publishWhenReady,
};
