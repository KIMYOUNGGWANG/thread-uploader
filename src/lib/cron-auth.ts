import crypto from "crypto";
import { NextRequest } from "next/server";

export function safeEqual(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function verifyCronSecret(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;

  // Fail-closed in production: missing secret blocks all requests
  if (!cronSecret) {
    // Permitted only in local development/testing when secret is intentionally unset
    return process.env.NODE_ENV !== "production";
  }

  // Header only: query-string secrets leak into access logs and referrers
  const authHeader = request.headers.get("authorization") ?? "";
  return safeEqual(authHeader, `Bearer ${cronSecret}`);
}
