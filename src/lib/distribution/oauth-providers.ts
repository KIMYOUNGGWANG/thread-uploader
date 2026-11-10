import { createHash, randomBytes } from "crypto";
import { isRecord } from "@/types/config-normalizers";
import { ChannelApiError, num, requestJson, str } from "./http";

export type OAuthPlatform = "youtube" | "tiktok" | "x";
export const OAUTH_PLATFORMS: readonly OAuthPlatform[] = ["youtube", "tiktok", "x"];

export function isOAuthPlatform(value: unknown): value is OAuthPlatform {
  return typeof value === "string" && (OAUTH_PLATFORMS as readonly string[]).includes(value);
}

export interface TokenSet {
  accessToken: string;
  /** Absent when the provider did not rotate it; keep the stored one. */
  refreshToken: string | null;
  expiresAt: Date;
}

export interface ChannelProfile {
  externalUserId: string;
  handle: string | null;
}

export interface AppCredentials {
  clientId: string;
  clientSecret: string;
}

interface ProviderSpec {
  label: string;
  envId: string;
  envSecret: string;
  usesPkce: boolean;
  authorizeUrl(input: { clientId: string; redirectUri: string; state: string; codeChallenge: string | null }): string;
  exchangeCode(app: AppCredentials, input: { code: string; redirectUri: string; codeVerifier: string | null }, now: Date): Promise<TokenSet>;
  refresh(app: AppCredentials, refreshToken: string, now: Date): Promise<TokenSet>;
  profile(accessToken: string): Promise<ChannelProfile>;
}

const form = (values: Record<string, string>) => new URLSearchParams(values);

function readTokenSet(provider: string, data: unknown, now: Date): TokenSet {
  // TikTok wraps nothing; Google and X return flat objects. All three use these names.
  const accessToken = isRecord(data) ? str(data.access_token) : null;
  if (!accessToken) throw new ChannelApiError(`${provider} token: response has no access_token`, null, true);
  const expiresIn = isRecord(data) ? num(data.expires_in) : null;
  return {
    accessToken,
    refreshToken: isRecord(data) ? str(data.refresh_token) : null,
    expiresAt: new Date(now.getTime() + (expiresIn ?? 3600) * 1000),
  };
}

const YOUTUBE_SCOPES = [
  "https://www.googleapis.com/auth/youtube.upload",
  "https://www.googleapis.com/auth/youtube.readonly",
];

const youtube: ProviderSpec = {
  label: "YouTube",
  envId: "YOUTUBE_CLIENT_ID",
  envSecret: "YOUTUBE_CLIENT_SECRET",
  usesPkce: false,
  authorizeUrl: ({ clientId, redirectUri, state }) =>
    `https://accounts.google.com/o/oauth2/v2/auth?${form({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: YOUTUBE_SCOPES.join(" "),
      access_type: "offline",
      // Without prompt=consent Google omits the refresh token on a reconnect.
      prompt: "consent",
      include_granted_scopes: "true",
      state,
    })}`,
  async exchangeCode(app, { code, redirectUri }, now) {
    const data = await requestJson("YouTube token", "https://oauth2.googleapis.com/token", {
      method: "POST",
      body: form({ code, client_id: app.clientId, client_secret: app.clientSecret, redirect_uri: redirectUri, grant_type: "authorization_code" }),
    });
    return readTokenSet("YouTube", data, now);
  },
  async refresh(app, refreshToken, now) {
    const data = await requestJson("YouTube token refresh", "https://oauth2.googleapis.com/token", {
      method: "POST",
      body: form({ refresh_token: refreshToken, client_id: app.clientId, client_secret: app.clientSecret, grant_type: "refresh_token" }),
    });
    return readTokenSet("YouTube", data, now);
  },
  async profile(accessToken) {
    const data = await requestJson("YouTube channel", "https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const item = isRecord(data) && Array.isArray(data.items) && isRecord(data.items[0]) ? data.items[0] : null;
    const id = item ? str(item.id) : null;
    if (!item || !id) throw new ChannelApiError("YouTube channel: this Google account has no YouTube channel", null, true);
    const snippet = isRecord(item.snippet) ? item.snippet : {};
    return { externalUserId: id, handle: str(snippet.customUrl) ?? str(snippet.title) };
  },
};

const tiktok: ProviderSpec = {
  label: "TikTok",
  envId: "TIKTOK_CLIENT_KEY",
  envSecret: "TIKTOK_CLIENT_SECRET",
  usesPkce: false,
  authorizeUrl: ({ clientId, redirectUri, state }) =>
    `https://www.tiktok.com/v2/auth/authorize/?${form({
      client_key: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      // video.list (metrics) needs the Display API product on the app; add it through TIKTOK_SCOPES once approved.
      scope: process.env.TIKTOK_SCOPES || "user.info.basic,video.publish",
      state,
    })}`,
  async exchangeCode(app, { code, redirectUri }, now) {
    const data = await requestJson("TikTok token", "https://open.tiktokapis.com/v2/oauth/token/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form({ client_key: app.clientId, client_secret: app.clientSecret, code, grant_type: "authorization_code", redirect_uri: redirectUri }),
    });
    return readTokenSet("TikTok", data, now);
  },
  async refresh(app, refreshToken, now) {
    const data = await requestJson("TikTok token refresh", "https://open.tiktokapis.com/v2/oauth/token/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form({ client_key: app.clientId, client_secret: app.clientSecret, grant_type: "refresh_token", refresh_token: refreshToken }),
    });
    return readTokenSet("TikTok", data, now);
  },
  async profile(accessToken) {
    const data = await requestJson("TikTok user", "https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const user = isRecord(data) && isRecord(data.data) && isRecord(data.data.user) ? data.data.user : null;
    const openId = user ? str(user.open_id) : null;
    if (!user || !openId) throw new ChannelApiError("TikTok user: response has no open_id", null, true);
    return { externalUserId: openId, handle: str(user.display_name) };
  },
};

const basicAuth = (app: AppCredentials) => `Basic ${Buffer.from(`${app.clientId}:${app.clientSecret}`).toString("base64")}`;

const x: ProviderSpec = {
  label: "X",
  envId: "X_CLIENT_ID",
  envSecret: "X_CLIENT_SECRET",
  usesPkce: true,
  authorizeUrl: ({ clientId, redirectUri, state, codeChallenge }) =>
    `https://x.com/i/oauth2/authorize?${form({
      response_type: "code",
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: "tweet.read tweet.write users.read offline.access media.write",
      state,
      code_challenge: codeChallenge ?? "",
      code_challenge_method: "S256",
    })}`,
  async exchangeCode(app, { code, redirectUri, codeVerifier }, now) {
    const data = await requestJson("X token", "https://api.x.com/2/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: basicAuth(app) },
      body: form({ code, grant_type: "authorization_code", redirect_uri: redirectUri, code_verifier: codeVerifier ?? "", client_id: app.clientId }),
    });
    return readTokenSet("X", data, now);
  },
  async refresh(app, refreshToken, now) {
    const data = await requestJson("X token refresh", "https://api.x.com/2/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: basicAuth(app) },
      body: form({ refresh_token: refreshToken, grant_type: "refresh_token", client_id: app.clientId }),
    });
    return readTokenSet("X", data, now);
  },
  async profile(accessToken) {
    const data = await requestJson("X user", "https://api.x.com/2/users/me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const user = isRecord(data) && isRecord(data.data) ? data.data : null;
    const id = user ? str(user.id) : null;
    if (!user || !id) throw new ChannelApiError("X user: response has no id", null, true);
    return { externalUserId: id, handle: str(user.username) };
  },
};

export const OAUTH_PROVIDERS: Record<OAuthPlatform, ProviderSpec> = { youtube, tiktok, x };

export function readAppCredentials(platform: OAuthPlatform, env: NodeJS.ProcessEnv = process.env): AppCredentials | null {
  const spec = OAUTH_PROVIDERS[platform];
  const clientId = env[spec.envId];
  const clientSecret = env[spec.envSecret];
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

export function createPkcePair(): { verifier: string; challenge: string } {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}
