import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifySession } from "@/lib/crypto";

const PUBLIC_PATHS = [
  "/login",
  "/api/auth/login",
  "/api/auth/register",
  "/api/products/auto-setup",
  "/api/cron",
  "/api/webhooks",
  "/api/oauth",
  "/api/cards",
  "/r/",
  "/attribution-tracker.js",
  "/_next",
  "/favicon.ico",
];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p.endsWith("/") ? p : `${p}/`));
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublic(pathname)) {
    return NextResponse.next();
  }

  const session = request.cookies.get("auth_session")?.value;
  const authenticated = Boolean(session && verifySession(session));

  if (!authenticated) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!login|api/auth/login|api/auth/register|_next/static|_next/image|favicon.ico).*)"],
};
