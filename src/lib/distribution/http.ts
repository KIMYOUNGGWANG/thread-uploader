import { isRecord } from "@/types/config-normalizers";

export const REQUEST_TIMEOUT_MS = 30_000;

export class ChannelApiError extends Error {
  readonly name = "ChannelApiError";
  constructor(
    message: string,
    readonly status: number | null = null,
    /** True when retrying the same request cannot succeed (bad input, revoked permission). */
    readonly permanent = false,
    /** During polling: the platform-side upload is dead, so start over instead of polling again. */
    readonly retryFromStart = false,
  ) {
    super(message);
  }
}

/** Pulls a readable message out of the error shapes Google, TikTok, X and Meta return. Never echoes tokens. */
export function readApiErrorMessage(data: unknown): string {
  if (!isRecord(data)) return "Unknown error";
  const error = data.error;
  if (typeof error === "string") {
    return typeof data.error_description === "string" ? `${error}: ${data.error_description}` : error;
  }
  if (isRecord(error)) {
    if (typeof error.message === "string" && error.message) return error.message;
    if (typeof error.code === "string" && error.code !== "ok") return error.code;
  }
  if (typeof data.detail === "string") return data.detail;
  if (typeof data.title === "string") return data.title;
  if (Array.isArray(data.errors) && isRecord(data.errors[0]) && typeof data.errors[0].message === "string") {
    return data.errors[0].message;
  }
  return "Unknown error";
}

export async function requestJson(stage: string, url: string, init: RequestInit = {}): Promise<unknown> {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const permanent = response.status === 400 || response.status === 403 || response.status === 404;
    throw new ChannelApiError(`${stage}: ${readApiErrorMessage(data)} (HTTP ${response.status})`, response.status, permanent);
  }
  return data;
}

export async function downloadMedia(url: string, maxBytes = 250 * 1024 * 1024): Promise<Uint8Array<ArrayBuffer>> {
  const response = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  if (!response.ok) throw new ChannelApiError(`media download: HTTP ${response.status}`, response.status);
  const buffer = new Uint8Array(await response.arrayBuffer());
  if (buffer.byteLength === 0) throw new ChannelApiError("media download: empty file", null, true);
  if (buffer.byteLength > maxBytes) throw new ChannelApiError(`media download: ${buffer.byteLength} bytes is over the limit`, null, true);
  return buffer;
}

export const str = (value: unknown): string | null => (typeof value === "string" && value ? value : null);
export const num = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) return Number(value);
  return null;
};
