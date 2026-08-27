const THREADS_OAUTH_AUTHORIZE_URL = "https://threads.net/oauth/authorize";
const THREADS_API_BASE = "https://graph.threads.net";

export const THREADS_APP_ID = process.env.THREADS_APP_ID ?? "2440826109698658";

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

export type ThreadsLongLivedToken = {
  readonly accessToken: string;
  readonly expiresIn: number;
};

export class ThreadsOAuthError extends Error {
  readonly name = "ThreadsOAuthError";
}

export function buildThreadsAuthorizationUrl(input: AuthorizationUrlInput): string {
  const parameters = new URLSearchParams({
    client_id: input.appId,
    redirect_uri: input.redirectUri,
    response_type: "code",
    scope: "threads_basic,threads_content_publish",
    state: input.state,
  });

  return `${THREADS_OAUTH_AUTHORIZE_URL}?${parameters}`;
}

export async function exchangeThreadsAuthorizationCode(input: AuthorizationCodeInput): Promise<string> {
  const parameters = new URLSearchParams({
    client_id: input.appId,
    client_secret: input.appSecret,
    code: input.code,
    grant_type: "authorization_code",
    redirect_uri: input.redirectUri,
  });
  const response = await fetch(`${THREADS_API_BASE}/oauth/access_token?${parameters}`, {
    method: "POST",
    signal: AbortSignal.timeout(15_000),
  });
  const data = await readJson(response);

  if (!response.ok) throw new ThreadsOAuthError(getErrorMessage(data));

  const accessToken = getString(data, "access_token");
  if (!accessToken) throw new ThreadsOAuthError("Meta did not return an access token.");
  return accessToken;
}

export async function exchangeThreadsLongLivedToken(input: LongLivedTokenInput): Promise<ThreadsLongLivedToken> {
  const parameters = new URLSearchParams({
    grant_type: "th_exchange_token",
    client_secret: input.appSecret,
    access_token: input.shortLivedToken,
  });
  const response = await fetch(`${THREADS_API_BASE}/access_token?${parameters}`, {
    signal: AbortSignal.timeout(15_000),
  });
  const data = await readJson(response);

  if (!response.ok) throw new ThreadsOAuthError(getErrorMessage(data));

  const accessToken = getString(data, "access_token");
  const expiresIn = getNumber(data, "expires_in");
  if (!accessToken || expiresIn === null) {
    throw new ThreadsOAuthError("Meta did not return a valid long-lived token.");
  }
  return { accessToken, expiresIn };
}

export async function getThreadsUserId(accessToken: string): Promise<string> {
  const response = await fetch(`${THREADS_API_BASE}/v1.0/me?fields=id`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(15_000),
  });
  const data = await readJson(response);

  if (!response.ok) throw new ThreadsOAuthError(getErrorMessage(data));

  const userId = getString(data, "id");
  if (!userId) throw new ThreadsOAuthError("Meta did not return a Threads user ID.");
  return userId;
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
  if (!isRecord(data)) return "Threads OAuth request failed.";
  const error = data["error"];
  if (!isRecord(error)) return "Threads OAuth request failed.";
  return getString(error, "message") ?? "Threads OAuth request failed.";
}

function getString(data: unknown, key: string): string | null {
  return isRecord(data) && typeof data[key] === "string" ? data[key] : null;
}

function getNumber(data: unknown, key: string): number | null {
  const value = isRecord(data) ? data[key] : null;
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
