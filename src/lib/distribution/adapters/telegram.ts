import { isRecord } from "@/types/config-normalizers";
import { ChannelApiError, REQUEST_TIMEOUT_MS } from "../http";
import type { ChannelCredentials } from "../accounts";
import type { ChannelAdapter, StepResult } from "./types";

const API = "https://api.telegram.org";
// Bot API limits (core.telegram.org/bots/api, checked 2026-11-19).
const TEXT_MAX = 4096;
const CAPTION_MAX = 1024;
const MEDIA_GROUP_MAX = 10;

/**
 * One Bot API call per upload. Anything that goes wrong after the request left — timeout, reset, 5xx, an odd
 * body — is permanent: Telegram may already have posted it, and the runner would otherwise send it again.
 * Only an explicit 429 (not posted) is retried. The token is in the URL, so no message here ever includes it.
 */
async function callTelegram(method: string, token: string, body: Record<string, unknown>): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(`${API}/bot${token}/${method}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    throw new ChannelApiError(`Telegram ${method}: 전송 여부 확인 필요 (연결 실패 또는 시간 초과) — 채널을 확인해줘`, null, true);
  }
  const data: unknown = await response.json().catch(() => null);
  if (isRecord(data) && data.ok === true) return data.result;
  const description = isRecord(data) && typeof data.description === "string" ? data.description.slice(0, 300) : null;
  if (response.status === 429) throw new ChannelApiError(`Telegram ${method}: 요청 한도 초과${description ? ` (${description})` : ""}`, 429, false);
  if ([400, 401, 403].includes(response.status) && description) {
    throw new ChannelApiError(`Telegram ${method}: ${description}`, response.status, true);
  }
  throw new ChannelApiError(`Telegram ${method}: 전송 여부 확인 필요 (HTTP ${response.status}) — 채널을 확인해줘`, response.status, true);
}

function firstMessageId(result: unknown): number | null {
  const message = Array.isArray(result) ? result[0] : result;
  return isRecord(message) && typeof message.message_id === "number" ? message.message_id : null;
}

/** Public channels are stored as "@name"; private ones (numeric id) have no public link. */
export function telegramPostUrl(handle: string | null, messageId: number | null): string | null {
  return handle?.startsWith("@") && messageId !== null ? `https://t.me/${handle.slice(1)}/${messageId}` : null;
}

function chatOf(creds: ChannelCredentials): string {
  if (!creds.externalUserId) throw new ChannelApiError("Telegram: no channel id (reconnect the channel)", null, true);
  return creds.externalUserId;
}

export const telegramAdapter: ChannelAdapter = {
  kinds: ["post"],
  async start(job, creds): Promise<StepResult> {
    const chat_id = chatOf(creds);
    const images = job.mediaUrls;
    const text = job.caption;
    const limit = images.length > 0 ? CAPTION_MAX : TEXT_MAX;
    // Checked before sending, so these never leave a half-posted message behind.
    if (images.length > MEDIA_GROUP_MAX) throw new ChannelApiError(`Telegram: 이미지는 ${MEDIA_GROUP_MAX}장까지야`, null, true);
    if (text.length > limit) throw new ChannelApiError(`Telegram: 글이 ${text.length}/${limit}자로 한도를 넘어`, null, true);

    let result: unknown;
    if (images.length === 0) {
      result = await callTelegram("sendMessage", creds.accessToken, { chat_id, text });
    } else if (images.length === 1) {
      result = await callTelegram("sendPhoto", creds.accessToken, { chat_id, photo: images[0], caption: text });
    } else {
      const media = images.map((url, index) => ({ type: "photo", media: url, ...(index === 0 && text ? { caption: text } : {}) }));
      result = await callTelegram("sendMediaGroup", creds.accessToken, { chat_id, media });
    }
    // ok:true means it is posted; an unreadable id must not turn that into a retry.
    const messageId = firstMessageId(result);
    return {
      state: "published",
      externalId: messageId !== null ? `${chat_id}:${messageId}` : `${chat_id}:unknown`,
      externalUrl: telegramPostUrl(creds.handle, messageId),
      platformData: { messageId },
    };
  },
};
