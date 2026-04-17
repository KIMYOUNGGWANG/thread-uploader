import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Skip auth for login page and its API
  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/api/auth/login") ||
    pathname.startsWith("/_next") ||
    pathname.includes("/favicon.ico")
  ) {
    return NextResponse.next();
  }

  // 2. Check for auth session cookie
  const session = request.cookies.get("auth_session");

  // 3. Redirect to /login if not authenticated
  if (!session || session.value !== "true") {
    // For API calls, return 401 instead of redirect
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

// See "Matching Paths" below to learn more
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api/auth/login (login endpoint)
     * - login (login page)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!login|api/auth/login|_next/static|_next/image|favicon.ico).*)",
  ],
};
