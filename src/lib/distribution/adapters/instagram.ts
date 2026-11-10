import {
  createCarouselContainer, createCarouselItemContainer, createReelsContainer, getContainerStatus,
  getMediaInsights, getMediaPermalink, publishContainer,
} from "@/lib/instagram-api";
import { ChannelApiError, str } from "../http";
import type { ChannelAdapter, ChannelMetrics, StepResult, UploadJob } from "./types";
import type { ChannelCredentials } from "../accounts";

const POLL_MS = 60_000;
const CAPTION_MAX = 2200;
const CAROUSEL_MIN = 2;
const CAROUSEL_MAX = 10;

function igCreds(creds: ChannelCredentials) {
  if (!creds.externalUserId) throw new ChannelApiError("Instagram: account has no user id (reconnect needed)", null, true);
  return { accessToken: creds.accessToken, userId: creds.externalUserId };
}

async function publishWhenReady(job: UploadJob, creds: ChannelCredentials): Promise<StepResult> {
  const containerId = str(job.platformData.containerId);
  if (!containerId) throw new ChannelApiError("Instagram: missing containerId", null, true);
  const status = await getContainerStatus(containerId, creds.accessToken);
  if (status === "IN_PROGRESS") return { state: "processing", platformData: job.platformData, retryAfterMs: POLL_MS };
  if (status === "ERROR" || status === "EXPIRED") {
    // A failed or expired container is gone for good; the runner retries the whole upload from start.
    throw new ChannelApiError(`Instagram container ${status}`, null, false, true);
  }
  const mediaId = await publishContainer(igCreds(creds), containerId);
  const permalink = await getMediaPermalink(mediaId, creds.accessToken);
  return { state: "published", externalId: mediaId, externalUrl: permalink, platformData: job.platformData };
}

export const instagramAdapter: ChannelAdapter = {
  kinds: ["video", "carousel"],
  async start(job, creds) {
    const account = igCreds(creds);
    const caption = job.caption.slice(0, CAPTION_MAX);
    if (job.kind === "video") {
      const videoUrl = job.mediaUrls[0];
      if (!videoUrl) throw new ChannelApiError("Instagram reel: no video URL", null, true);
      const containerId = await createReelsContainer(account, { videoUrl, caption });
      return { state: "processing", platformData: { containerId }, retryAfterMs: POLL_MS };
    }
    const images = job.mediaUrls.slice(0, CAROUSEL_MAX);
    if (images.length < CAROUSEL_MIN) throw new ChannelApiError(`Instagram carousel: needs ${CAROUSEL_MIN}+ images`, null, true);
    const childIds: string[] = [];
    for (const url of images) childIds.push(await createCarouselItemContainer(account, url));
    const containerId = await createCarouselContainer(account, { childIds, caption });
    return { state: "processing", platformData: { containerId, childIds }, retryAfterMs: 15_000 };
  },
  poll: publishWhenReady,
  async metrics(externalIds, creds) {
    const out: ChannelMetrics[] = [];
    for (const id of externalIds) {
      try {
        const values = await getMediaInsights(id, creds.accessToken, ["views", "likes", "comments", "shares", "saved", "reach"]);
        out.push({
          externalId: id, views: values.views ?? null, likes: values.likes ?? null, comments: values.comments ?? null,
          shares: values.shares ?? null, saves: values.saved ?? null, reach: values.reach ?? null,
        });
      } catch {
        // One media failing (deleted, metric unsupported) must not drop the rest.
      }
    }
    return out;
  },
};
