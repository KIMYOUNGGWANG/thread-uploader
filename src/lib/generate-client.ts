export const GENERATE_POSTS_REQUEST_CHUNK_SIZE = 7;

export type ApiErrorPayload = {
  readonly error?: string;
};

export type GeneratePostsInChunksInput = {
  readonly brandId: string;
  readonly count: number;
  readonly insertAtFront?: boolean;
  readonly campaignId?: string | null;
  readonly approvedCampaignStart?: boolean;
  readonly fallbackMessage: string;
  readonly chunkSize?: number;
};

export type GeneratePostsInChunksResult = {
  readonly count: number;
  readonly linkedCount: number;
  readonly campaignId: string | null;
};

type GeneratePostsResponse = ApiErrorPayload & {
  readonly count?: number;
  readonly linkedCount?: number;
  readonly campaignId?: string | null;
};

export async function readJsonObjectResponse<T extends object>(
  response: Response,
  fallbackMessage: string
): Promise<T & ApiErrorPayload> {
  const raw = await response.text();
  if (!raw.trim()) return { error: response.ok ? undefined : fallbackMessage } as T & ApiErrorPayload;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (isRecord(parsed)) {
      if ("error" in parsed) {
        return {
          ...parsed,
          error: normalizeApiErrorValue(parsed.error, fallbackMessage),
        } as T & ApiErrorPayload;
      }
      return parsed as T & ApiErrorPayload;
    }
    return { error: fallbackMessage } as T & ApiErrorPayload;
  } catch {
    return { error: normalizePlainTextError(raw, fallbackMessage) } as T & ApiErrorPayload;
  }
}

export async function generatePostsInChunks(
  input: GeneratePostsInChunksInput
): Promise<GeneratePostsInChunksResult> {
  const totalRequested = Math.max(1, Math.round(input.count));
  const chunkSize = Math.max(1, input.chunkSize ?? GENERATE_POSTS_REQUEST_CHUNK_SIZE);
  let remaining = totalRequested;
  let count = 0;
  let linkedCount = 0;
  let campaignId: string | null = null;

  while (remaining > 0) {
    const currentCount = Math.min(chunkSize, remaining);
    const response = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        brandId: input.brandId,
        count: currentCount,
        insertAtFront: input.insertAtFront === true,
        campaignId: input.campaignId ?? undefined,
        approvedCampaignStart: input.approvedCampaignStart === true,
      }),
    });
    const data = await readJsonObjectResponse<GeneratePostsResponse>(
      response,
      input.fallbackMessage
    );
    if (!response.ok) throw new Error(data.error ?? input.fallbackMessage);

    count += data.count ?? currentCount;
    linkedCount += data.linkedCount ?? 0;
    campaignId = data.campaignId ?? campaignId;
    remaining -= currentCount;
  }

  return { count, linkedCount, campaignId };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizePlainTextError(raw: string, fallbackMessage: string): string {
  const normalized = raw.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  return normalized ? normalized.slice(0, 220) : fallbackMessage;
}

function normalizeApiErrorValue(value: unknown, fallbackMessage: string): string {
  if (typeof value === "string") return value.trim() || fallbackMessage;
  if (value instanceof Error) return value.message || fallbackMessage;
  if (!isRecord(value)) return fallbackMessage;

  const message = value.message ?? value.error ?? value.detail;
  if (typeof message === "string") return message.trim() || fallbackMessage;
  if (isRecord(message)) return normalizeApiErrorValue(message, fallbackMessage);

  return normalizePlainTextError(JSON.stringify(value), fallbackMessage);
}
