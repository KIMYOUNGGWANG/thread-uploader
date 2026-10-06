export const THREADS_API_BASE = "https://graph.threads.net/v1.0";
export const FIRST_COMMENT_FAILURE_PREFIX = "First comment failed:";

export interface ThreadsCredentials {
  accessToken: string;
  userId: string;
}

export interface CircuitBreakerState {
  consecutiveFailures: number;
  pausedUntil: string | null;
  lastFailureReason?: string | null;
}

export interface BrandConfigWithBreaker {
  circuitBreaker?: CircuitBreakerState;
  [key: string]: any;
}

export function checkCircuitBreaker(
  config: BrandConfigWithBreaker,
  now: Date = new Date()
): { isAllowed: boolean; reason?: string } {
  const breaker = config.circuitBreaker;
  if (!breaker || !breaker.pausedUntil) {
    return { isAllowed: true };
  }

  const pauseExpiresAt = new Date(breaker.pausedUntil);
  if (pauseExpiresAt.getTime() > now.getTime()) {
    return {
      isAllowed: false,
      reason: `Circuit breaker active until ${breaker.pausedUntil}. Last reason: ${breaker.lastFailureReason || "Unknown"}`,
    };
  }

  return { isAllowed: true };
}

export function recordCircuitBreakerFailure(
  config: BrandConfigWithBreaker,
  reason: string,
  threshold: number = 3,
  pauseDurationMs: number = 60 * 60 * 1000,
  now: Date = new Date()
): BrandConfigWithBreaker {
  const currentFailures = (config.circuitBreaker?.consecutiveFailures || 0) + 1;
  const shouldPause = currentFailures >= threshold;
  const pausedUntil = shouldPause ? new Date(now.getTime() + pauseDurationMs).toISOString() : null;

  return {
    ...config,
    circuitBreaker: {
      consecutiveFailures: currentFailures,
      pausedUntil,
      lastFailureReason: reason,
    },
  };
}

export function recordCircuitBreakerSuccess(config: BrandConfigWithBreaker): BrandConfigWithBreaker {
  return {
    ...config,
    circuitBreaker: {
      consecutiveFailures: 0,
      pausedUntil: null,
      lastFailureReason: null,
    },
  };
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function splitIntoThreadParts(text: string, maxLength: number = 480, maxParts: number = 5): string[] {
  const trimmed = text.trim();
  if (trimmed.length <= 500) return [trimmed];

  const paragraphs = trimmed.split(/\n\s*\n/);
  const chunks: string[] = [];
  for (const p of paragraphs) {
    const tp = p.trim();
    if (tp) chunks.push(tp);
  }

  for (let targetParts = 2; targetParts <= maxParts; targetParts++) {
    const parts: string[] = [];
    let chunkIndex = 0;

    for (let p = 0; p < targetParts; p++) {
      const prefix = `${p + 1}/${targetParts}\n\n`;
      const available = maxLength - prefix.length;
      let partBody = "";

      while (chunkIndex < chunks.length) {
        const nextChunk = chunks[chunkIndex];
        const sep = partBody.length > 0 ? "\n\n" : "";
        if (partBody.length + sep.length + nextChunk.length <= available) {
          partBody = partBody ? `${partBody}\n\n${nextChunk}` : nextChunk;
          chunkIndex++;
        } else {
          break;
        }
      }
      if (!partBody && chunkIndex < chunks.length) {
        partBody = chunks[chunkIndex].slice(0, available);
        chunks[chunkIndex] = chunks[chunkIndex].slice(available).trim();
      }
      parts.push(`${prefix}${partBody}`);
    }
    if (chunkIndex >= chunks.length) return parts;
  }

  return [trimmed.slice(0, 500)];
}

async function pollContainerStatus(
  containerId: string,
  accessToken: string,
  maxAttempts: number = 8,
  delayMs: number = 3000
): Promise<void> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await sleep(delayMs);
    const statusRes = await fetch(
      `${THREADS_API_BASE}/${containerId}?fields=status,error_message&access_token=${accessToken}`
    );
    const statusData = await statusRes.json();
    if (statusData.status === "FINISHED") {
      return;
    }
    if (statusData.status === "ERROR") {
      throw new Error(`Media processing error: ${statusData.error_message || "Unknown error"}`);
    }
  }
}

export async function publishPost(
  text: string,
  credentials: ThreadsCredentials,
  imageUrls: string[] = []
): Promise<string> {
  const validHttpImageUrls = (imageUrls || []).filter(
    (url) => typeof url === "string" && /^https?:\/\//i.test(url)
  );

  let containerId: string;

  if (validHttpImageUrls.length === 0) {
    // 1. Text only
    const params = new URLSearchParams({
      media_type: "TEXT",
      text,
      access_token: credentials.accessToken,
    });
    const res = await fetch(`${THREADS_API_BASE}/${credentials.userId}/threads?${params}`, {
      method: "POST",
    });
    const data = await res.json();
    if (!res.ok) throw new Error(`Threads API Error (Text): ${data.error?.message || "Unknown error"}`);
    containerId = data.id;
    await sleep(3000);
  } else if (validHttpImageUrls.length === 1) {
    // 2. Single Image
    const params = new URLSearchParams({
      media_type: "IMAGE",
      image_url: validHttpImageUrls[0],
      text,
      access_token: credentials.accessToken,
    });
    const res = await fetch(`${THREADS_API_BASE}/${credentials.userId}/threads?${params}`, {
      method: "POST",
    });
    const data = await res.json();
    if (!res.ok) throw new Error(`Threads API Error (Image): ${data.error?.message || "Unknown error"}`);
    containerId = data.id;

    await pollContainerStatus(containerId, credentials.accessToken);
  } else {
    // 3. Carousel (Multiple Images)
    const childContainerIds: string[] = [];

    for (const url of validHttpImageUrls) {
      const childParams = new URLSearchParams({
        media_type: "IMAGE",
        image_url: url,
        is_carousel_item: "true",
        access_token: credentials.accessToken,
      });
      const childRes = await fetch(`${THREADS_API_BASE}/${credentials.userId}/threads?${childParams}`, {
        method: "POST",
      });
      const childData = await childRes.json();
      if (!childRes.ok) {
        throw new Error(`Threads API Error (Carousel Item): ${childData.error?.message || "Unknown error"}`);
      }
      childContainerIds.push(childData.id);
    }

    // Wait for all child image containers to finish processing
    for (const childId of childContainerIds) {
      await pollContainerStatus(childId, credentials.accessToken);
    }

    // Create parent carousel container
    const carouselParams = new URLSearchParams({
      media_type: "CAROUSEL",
      children: childContainerIds.join(","),
      text,
      access_token: credentials.accessToken,
    });
    const carouselRes = await fetch(`${THREADS_API_BASE}/${credentials.userId}/threads?${carouselParams}`, {
      method: "POST",
    });
    const carouselData = await carouselRes.json();
    if (!carouselRes.ok) {
      throw new Error(`Threads API Error (Carousel Parent): ${carouselData.error?.message || "Unknown error"}`);
    }
    containerId = carouselData.id;

    await pollContainerStatus(containerId, credentials.accessToken);
  }

  // Publish container
  const pubParams = new URLSearchParams({
    creation_id: containerId,
    access_token: credentials.accessToken,
  });
  const pubRes = await fetch(`${THREADS_API_BASE}/${credentials.userId}/threads_publish?${pubParams}`, {
    method: "POST",
  });
  const pubData = await pubRes.json();
  if (!pubRes.ok) throw new Error(`Threads Publish Error: ${pubData.error?.message || "Unknown error"}`);

  return pubData.id;
}

export async function publishReply(
  text: string,
  replyToId: string,
  credentials: ThreadsCredentials
): Promise<string> {
  const params = new URLSearchParams({
    media_type: "TEXT",
    text,
    reply_to_id: replyToId,
    access_token: credentials.accessToken,
  });

  const res = await fetch(`${THREADS_API_BASE}/${credentials.userId}/threads?${params}`, {
    method: "POST",
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Threads API Error (Reply): ${data.error?.message || "Unknown error"}`);
  }

  await sleep(2000);

  const pubParams = new URLSearchParams({
    creation_id: data.id,
    access_token: credentials.accessToken,
  });
  const pubRes = await fetch(`${THREADS_API_BASE}/${credentials.userId}/threads_publish?${pubParams}`, {
    method: "POST",
  });
  const pubData = await pubRes.json();
  if (!pubRes.ok) {
    throw new Error(`Threads Publish Error (Reply): ${pubData.error?.message || "Unknown error"}`);
  }

  return pubData.id;
}

export async function publishReplyWithRetry(
  text: string,
  replyToId: string,
  credentials: ThreadsCredentials,
  retries: number = 4,
  initialDelayMs: number = 4000
): Promise<string> {
  let lastError: any = null;
  await sleep(initialDelayMs);

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await publishReply(text, replyToId, credentials);
    } catch (error) {
      lastError = error;
      if (attempt === retries) break;
      const retryDelayMs = 3000 * attempt;
      await sleep(retryDelayMs);
    }
  }

  throw lastError || new Error("Failed to publish first comment");
}
