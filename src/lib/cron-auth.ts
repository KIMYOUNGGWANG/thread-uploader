import { NextRequest } from "next/server";

export function verifyCronSecret(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;

  // Fail-closed in production: missing secret blocks all requests
  if (!cronSecret) {
    if (process.env.NODE_ENV === "production") {
      return false;
    }
    // Permitted only in local development/testing when secret is intentionally unset
    return true;
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader === `Bearer ${cronSecret}`) {
    return true;
  }

  return request.nextUrl.searchParams.get("secret") === cronSecret;
}
