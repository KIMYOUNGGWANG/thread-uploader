import { isRecord } from "@/types/config-normalizers";
import { ChannelApiError, num, requestJson, str } from "../http";
import { X_MAX_WEIGHT, xWeightedLength } from "../x-text";
import type { ChannelAdapter, ChannelMetrics } from "./types";

export const xAdapter: ChannelAdapter = {
  kinds: ["text"],
  async start(job, creds) {
    const text = job.caption.trim();
    if (!text) throw new ChannelApiError("X post: empty text", null, true);
    if (xWeightedLength(text) > X_MAX_WEIGHT) throw new ChannelApiError("X post: text is over 280", null, true);
    const data = await requestJson("X post", "https://api.x.com/2/tweets", {
      method: "POST",
      headers: { Authorization: `Bearer ${creds.accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    const id = isRecord(data) && isRecord(data.data) ? str(data.data.id) : null;
    if (!id) throw new ChannelApiError("X post: response has no id");
    const handle = creds.handle ? creds.handle.replace(/^@/, "") : "i/web";
    return { state: "published", externalId: id, externalUrl: `https://x.com/${handle}/status/${id}` };
  },
  async metrics(externalIds, creds) {
    const out: ChannelMetrics[] = [];
    for (let i = 0; i < externalIds.length; i += 100) {
      const ids = externalIds.slice(i, i + 100).join(",");
      const data = await requestJson("X metrics", `https://api.x.com/2/tweets?ids=${encodeURIComponent(ids)}&tweet.fields=public_metrics`, {
        headers: { Authorization: `Bearer ${creds.accessToken}` },
      });
      const tweets = isRecord(data) && Array.isArray(data.data) ? data.data : [];
      for (const t of tweets) {
        if (!isRecord(t) || !str(t.id)) continue;
        const m = isRecord(t.public_metrics) ? t.public_metrics : {};
        out.push({ externalId: t.id as string, views: num(m.impression_count), likes: num(m.like_count), comments: num(m.reply_count), shares: num(m.retweet_count) });
      }
    }
    return out;
  },
};
