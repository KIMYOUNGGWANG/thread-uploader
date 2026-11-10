import type { ChannelAccount } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { decryptToken, encrypt } from "@/lib/crypto";
import { getFreshInstagramCredentials } from "@/lib/instagram-api";
import { ensureLegacyChannelAccount } from "@/lib/channels/publication-mirror";
import { ChannelApiError } from "./http";
import { OAUTH_PROVIDERS, isOAuthPlatform, readAppCredentials, type ChannelProfile, type OAuthPlatform, type TokenSet } from "./oauth-providers";

export type UploadPlatform = OAuthPlatform | "instagram";

export interface ChannelCredentials {
  accessToken: string;
  externalUserId: string | null;
  handle: string | null;
}

// Refresh a little early so a token cannot expire between the check and a long video upload.
const EARLY_REFRESH_MS = 10 * 60 * 1000;

export async function saveConnectedAccount(
  brandId: string,
  platform: OAuthPlatform,
  profile: ChannelProfile,
  tokens: TokenSet,
  now = new Date(),
): Promise<ChannelAccount> {
  const existing = await prisma.channelAccount.findFirst({ where: { brandId, platform }, orderBy: { createdAt: "asc" } });
  const data = {
    mode: "direct",
    externalUserId: profile.externalUserId,
    handle: profile.handle,
    accessToken: encrypt(tokens.accessToken),
    // A reconnect that returns no refresh token keeps the stored one.
    ...(tokens.refreshToken ? { refreshToken: encrypt(tokens.refreshToken) } : {}),
    tokenExpiry: tokens.expiresAt,
    enabled: true,
    connectedAt: existing?.connectedAt ?? now,
  };
  // One account per platform per brand: reconnecting a different channel replaces the old one.
  if (existing) return prisma.channelAccount.update({ where: { id: existing.id }, data });
  return prisma.channelAccount.create({ data: { brandId, platform, ...data } });
}

export function isTokenFresh(expiry: Date | null, now: Date): boolean {
  return expiry !== null && expiry.getTime() - EARLY_REFRESH_MS > now.getTime();
}

async function refreshAccount(account: ChannelAccount, platform: OAuthPlatform, now: Date): Promise<string> {
  const app = readAppCredentials(platform);
  if (!app) throw new ChannelApiError(`${OAUTH_PROVIDERS[platform].label}: app credentials are not configured`, null, true);
  if (!account.refreshToken) throw new ChannelApiError(`${OAUTH_PROVIDERS[platform].label}: reconnect needed (no refresh token)`, null, true);
  let tokens: TokenSet;
  try {
    tokens = await OAUTH_PROVIDERS[platform].refresh(app, decryptToken(account.refreshToken), now);
  } catch (error) {
    // invalid_grant = revoked or expired refresh token; only a reconnect fixes it.
    const message = error instanceof Error ? error.message : String(error);
    throw new ChannelApiError(`${OAUTH_PROVIDERS[platform].label}: reconnect needed (${message})`, null, true);
  }
  await prisma.channelAccount.update({
    where: { id: account.id },
    data: {
      accessToken: encrypt(tokens.accessToken),
      ...(tokens.refreshToken ? { refreshToken: encrypt(tokens.refreshToken) } : {}),
      tokenExpiry: tokens.expiresAt,
    },
  });
  return tokens.accessToken;
}

export async function getChannelCredentials(account: ChannelAccount, now = new Date()): Promise<ChannelCredentials> {
  if (account.platform === "instagram") {
    const creds = await getFreshInstagramCredentials(account.brandId);
    if (!creds) throw new ChannelApiError("Instagram: not connected or token expired (reconnect needed)", null, true);
    return { accessToken: creds.accessToken, externalUserId: creds.userId, handle: account.handle };
  }
  if (!isOAuthPlatform(account.platform)) throw new ChannelApiError(`Unsupported platform: ${account.platform}`, null, true);
  const accessToken = account.accessToken && isTokenFresh(account.tokenExpiry, now)
    ? decryptToken(account.accessToken)
    : await refreshAccount(account, account.platform, now);
  return { accessToken, externalUserId: account.externalUserId, handle: account.handle };
}

/** Enabled accounts per platform for a brand. Instagram rides on Brand tokens through its legacy account row. */
export async function getUploadAccounts(
  brand: { id: string; instagramAccessToken: string | null; instagramTokenExpiry: Date | null },
  now = new Date(),
): Promise<Map<UploadPlatform, ChannelAccount>> {
  const accounts = new Map<UploadPlatform, ChannelAccount>();
  if (brand.instagramAccessToken && brand.instagramTokenExpiry && brand.instagramTokenExpiry > now) {
    const id = await ensureLegacyChannelAccount(brand.id, "instagram");
    const account = await prisma.channelAccount.findUnique({ where: { id } });
    if (account?.enabled) accounts.set("instagram", account);
  }
  const rows = await prisma.channelAccount.findMany({
    where: { brandId: brand.id, enabled: true, platform: { in: ["youtube", "tiktok", "x"] }, accessToken: { not: null } },
    orderBy: { createdAt: "asc" },
  });
  for (const row of rows) {
    if (isOAuthPlatform(row.platform) && !accounts.has(row.platform)) accounts.set(row.platform, row);
  }
  return accounts;
}
