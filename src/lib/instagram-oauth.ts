import { isRecord } from "@/types/config-normalizers";

const INSTAGRAM_OAUTH_AUTHORIZE_URL = "https://www.instagram.com/oauth/authorize";
const INSTAGRAM_TOKEN_URL = "https://api.instagram.com/oauth/access_token";
const INSTAGRAM_TOKEN_BASE = "https://graph.instagram.com";
const REQUEST_TIMEOUT_MS = 15_000;

export const INSTAGRAM_GRAPH_BASE = "https://graph.instagram.com/v26.0";

type AuthorizationUrlInput = {
  readonly appId: string;
  readonly redirectUri: string;
  readonly state: string;
};

type AuthorizationCodeInput = {
  readonly appId: string;
  readonly appSecret: string;
  readonly code: string;
  readonly redirectUri: string;
};

type LongLivedTokenInput = {
  readonly appSecret: string;
  readonly shortLivedToken: string;
};

export type InstagramLongLivedToken = {
  readonly accessToken: string;
  readonly expiresIn: number;
};

export type InstagramProfile = {
  readonly userId: string;
  readonly username: string;
};

export class InstagramOAuthError extends Error {
  readonly name = "InstagramOAuthError";
}

export function buildInstagramAuthorizationUrl(input: AuthorizationUrlInput): string {
  const parameters = new URLSearchParams({
    client_id: input.appId,
    redirect_uri: input.redirectUri,
    response_type: "code",
    scope: "instagram_business_basic,instagram_business_content_publish",
    state: input.state,
  });

  return `${INSTAGRAM_OAUTH_AUTHORIZE_URL}?${parameters}`;
}

export async function exchangeInstagramAuthorizationCode(input: AuthorizationCodeInput): Promise<string> {
  const body = new URLSearchParams({
    client_id: input.appId,
    client_secret: input.appSecret,
    code: input.code,
    grant_type: "authorization_code",
    redirect_uri: input.redirectUri,
  });
  const response = await fetch(INSTAGRAM_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  const data = await readJson(response);

  if (!response.ok) throw new InstagramOAuthError(getErrorMessage(data));

  const accessToken = getString(data, "access_token");
  if (!accessToken) throw new InstagramOAuthError("Instagram did not return an access token.");
  return accessToken;
}

export async function exchangeInstagramLongLivedToken(input: LongLivedTokenInput): Promise<InstagramLongLivedToken> {
  const parameters = new URLSearchParams({
    grant_type: "ig_exchange_token",
    client_secret: input.appSecret,
    access_token: input.shortLivedToken,
  });
  return requestLongLivedToken(`${INSTAGRAM_TOKEN_BASE}/access_token?${parameters}`);
}

export async function refreshInstagramLongLivedToken(accessToken: string): Promise<InstagramLongLivedToken> {
  const parameters = new URLSearchParams({
    grant_type: "ig_refresh_token",
    access_token: accessToken,
  });
  return requestLongLivedToken(`${INSTAGRAM_TOKEN_BASE}/refresh_access_token?${parameters}`);
}

export async function getInstagramProfile(accessToken: string): Promise<InstagramProfile> {
  const response = await fetch(`${INSTAGRAM_GRAPH_BASE}/me?fields=user_id,username`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  const data = await readJson(response);

  if (!response.ok) throw new InstagramOAuthError(getErrorMessage(data));

  const userId = getString(data, "user_id");
  const username = getString(data, "username");
  if (!userId || !username) throw new InstagramOAuthError("Instagram did not return a valid profile.");
  return { userId, username };
}

async function requestLongLivedToken(url: string): Promise<InstagramLongLivedToken> {
  const response = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  const data = await readJson(response);

  if (!response.ok) throw new InstagramOAuthError(getErrorMessage(data));

  const accessToken = getString(data, "access_token");
  const expiresIn = getNumber(data, "expires_in");
  if (!accessToken || expiresIn === null) {
    throw new InstagramOAuthError("Instagram did not return a valid long-lived token.");
  }
  return { accessToken, expiresIn };
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch (error) {
    if (error instanceof SyntaxError) return null;
    throw error;
  }
}

function getErrorMessage(data: unknown): string {
  const fallback = "Instagram OAuth request failed.";
  if (!isRecord(data)) return fallback;
  const error = data["error"];
  // graph.instagram.com nests { error: { message } }; api.instagram.com returns a top-level error_message.
  const nestedMessage = isRecord(error) ? getString(error, "message") : null;
  return nestedMessage ?? getString(data, "error_message") ?? fallback;
}

function getString(data: unknown, key: string): string | null {
  return isRecord(data) && typeof data[key] === "string" ? data[key] : null;
}

function getNumber(data: unknown, key: string): number | null {
  const value = isRecord(data) ? data[key] : null;
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}
