import { decryptToken, encrypt } from "@/lib/crypto";
import { INSTAGRAM_GRAPH_BASE, refreshInstagramLongLivedToken } from "@/lib/instagram-oauth";
import { isTokenRefreshDue } from "@/lib/threads-api";
import { isRecord } from "@/types/config-normalizers";

const REQUEST_TIMEOUT_MS = 30_000;
const CONTAINER_STATUSES = ["IN_PROGRESS", "FINISHED", "ERROR", "EXPIRED", "PUBLISHED"] as const;

export interface InstagramCredentials {
  accessToken: string;
  userId: string;
}

export type InstagramContainerStatus = (typeof CONTAINER_STATUSES)[number];

export async function createReelsContainer(
  credentials: InstagramCredentials,
  input: { videoUrl: string; caption: string },
): Promise<string> {
  const body = new URLSearchParams({
    media_type: "REELS",
    video_url: input.videoUrl,
    caption: input.caption,
    share_to_feed: "true",
    access_token: credentials.accessToken,
  });
  const data = await requestInstagram("container creation", `${INSTAGRAM_GRAPH_BASE}/${credentials.userId}/media`, {
    method: "POST",
    body,
  });
  return readId("container creation", data);
}

export async function getContainerStatus(containerId: string, accessToken: string): Promise<InstagramContainerStatus> {
  const data = await requestInstagram("status check", `${INSTAGRAM_GRAPH_BASE}/${containerId}?fields=status_code`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const statusCode = isRecord(data) ? data["status_code"] : null;
  const status = CONTAINER_STATUSES.find((candidate) => candidate === statusCode);
  if (!status) throw new Error(`Instagram API Error (status check): unknown status_code ${String(statusCode)}`);
  return status;
}

export async function publishContainer(credentials: InstagramCredentials, containerId: string): Promise<string> {
  const body = new URLSearchParams({ creation_id: containerId, access_token: credentials.accessToken });
  const data = await requestInstagram("publish", `${INSTAGRAM_GRAPH_BASE}/${credentials.userId}/media_publish`, {
    method: "POST",
    body,
  });
  return readId("publish", data);
}

/** Remaining reels quota, or null when the response can't be read (shape is unverified; never throws). */
export async function getRemainingPublishQuota(credentials: InstagramCredentials): Promise<number | null> {
  const url = `${INSTAGRAM_GRAPH_BASE}/${credentials.userId}/content_publishing_limit?fields=quota_usage,config`;
  try {
    const data = await requestInstagram("quota check", url, {
      headers: { Authorization: `Bearer ${credentials.accessToken}` },
    });
    return parseRemainingQuota(data);
  } catch {
    return null;
  }
}

export async function getFreshInstagramCredentials(brandId: string): Promise<InstagramCredentials | null> {
  const { prisma } = await import("@/lib/prisma");
  const brand = await prisma.brand.findUnique({
    where: { id: brandId },
    select: { instagramAccessToken: true, instagramUserId: true, instagramTokenExpiry: true },
  });
  if (!brand?.instagramAccessToken || !brand.instagramUserId || !brand.instagramTokenExpiry) return null;
  if (brand.instagramTokenExpiry <= new Date()) return null;

  const storedToken = decryptToken(brand.instagramAccessToken);
  if (!isTokenRefreshDue(brand.instagramTokenExpiry)) {
    return { accessToken: storedToken, userId: brand.instagramUserId };
  }
  const refreshed = await refreshAndStoreToken(brandId, storedToken);
  return { accessToken: refreshed.accessToken, userId: brand.instagramUserId };
}

export async function refreshBrandInstagramToken(brandId: string): Promise<{ accessToken: string; expiresIn: number }> {
  const { prisma } = await import("@/lib/prisma");
  const brand = await prisma.brand.findUnique({ where: { id: brandId }, select: { instagramAccessToken: true } });
  if (!brand?.instagramAccessToken) throw new Error(`Instagram is not connected for brand: ${brandId}`);
  return refreshAndStoreToken(brandId, decryptToken(brand.instagramAccessToken));
}

async function refreshAndStoreToken(brandId: string, accessToken: string): Promise<{ accessToken: string; expiresIn: number }> {
  const { prisma } = await import("@/lib/prisma");
  const refreshed = await refreshInstagramLongLivedToken(accessToken).catch((error: unknown) => {
    throw new Error(`Instagram API Error (token refresh): ${error instanceof Error ? error.message : "Unknown error"}`);
  });
  await prisma.brand.update({
    where: { id: brandId },
    data: {
      instagramAccessToken: encrypt(refreshed.accessToken),
      instagramTokenExpiry: new Date(Date.now() + refreshed.expiresIn * 1000),
    },
  });
  return { accessToken: refreshed.accessToken, expiresIn: refreshed.expiresIn };
}

async function requestInstagram(stage: string, url: string, init: RequestInit): Promise<unknown> {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`Instagram API Error (${stage}): ${readErrorMessage(data)}`);
  return data;
}

function readErrorMessage(data: unknown): string {
  const error = isRecord(data) ? data["error"] : null;
  const message = isRecord(error) ? error["message"] : null;
  return typeof message === "string" ? message : "Unknown error";
}

function readId(stage: string, data: unknown): string {
  const id = isRecord(data) ? data["id"] : null;
  if (typeof id !== "string" || !id) throw new Error(`Instagram API Error (${stage}): response has no id`);
  return id;
}

function parseRemainingQuota(data: unknown): number | null {
  const entries = isRecord(data) ? data["data"] : null;
  const entry: unknown = Array.isArray(entries) ? entries[0] : null;
  if (!isRecord(entry) || !isRecord(entry["config"])) return null;
  const used = entry["quota_usage"];
  const total = entry["config"]["quota_total"];
  return typeof used === "number" && typeof total === "number" ? total - used : null;
}
