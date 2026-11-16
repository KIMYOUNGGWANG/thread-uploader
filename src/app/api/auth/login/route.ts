import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { createSessionToken, hashPassword, verifyPassword } from "@/lib/auth";
import { checkLoginAttempt, clientIp, LOGIN_RETRY_AFTER_SECONDS, recordLoginSuccess } from "@/lib/login-rate-limit";

// A real scrypt hash for unknown emails, so they cost the same time as a wrong password.
const dummyPasswordHash = hashPassword(crypto.randomUUID());

export async function POST(request: Request) {
  try {
    const body = await request.json() as { email?: unknown; password?: unknown };
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : null;
    const password = typeof body.password === "string" ? body.password : null;

    if (!email || !password) {
      return NextResponse.json({ error: "이메일과 비밀번호를 입력해주세요" }, { status: 400 });
    }

    const attempt = await checkLoginAttempt(clientIp(request), email);
    if (!attempt.allowed) {
      return NextResponse.json(
        { error: "로그인 시도가 너무 많습니다. 15분 뒤에 다시 시도해주세요" },
        { status: 429, headers: { "Retry-After": String(LOGIN_RETRY_AFTER_SECONDS) } }
      );
    }

    const user = await prisma.user.findUnique({ where: { email } });
    const valid = await verifyPassword(password, user?.password ?? (await dummyPasswordHash));
    if (!user || !valid) {
      return NextResponse.json({ error: "이메일 또는 비밀번호가 올바르지 않습니다" }, { status: 401 });
    }
    await recordLoginSuccess(attempt.pairKey);

    const sessionToken = createSessionToken(user.id);
    const cookieStore = await cookies();
    cookieStore.set("auth_session", sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    });

    return NextResponse.json({
      success: true,
      user: { id: user.id, email: user.email, name: user.name },
    });
  } catch (error) {
    console.error("[auth/login] Failed:", error);
    return NextResponse.json({ error: "로그인 처리 중 오류가 발생했습니다" }, { status: 500 });
  }
}
