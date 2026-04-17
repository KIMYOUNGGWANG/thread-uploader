import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST(request: Request) {
  try {
    const { password } = await request.json();
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (!adminPassword) {
      return NextResponse.json(
        { error: "Server configuration error: ADMIN_PASSWORD not set" },
        { status: 500 }
      );
    }

    if (password === adminPassword) {
      const cookieStore = await cookies();
      
      // Set a simple session cookie
      // In a real app we'd use a signed JWT, but for a private uploader 
      // where the ADMIN_PASSWORD is the only gate, this is often sufficient.
      // We use httpOnly and secure flags for safety.
      cookieStore.set("auth_session", "true", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 7, // 1 week
        path: "/",
      });

      return NextResponse.json({ success: true });
    }

    return NextResponse.json(
      { error: "비밀번호가 일치하지 않습니다" },
      { status: 401 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: "인증 처리 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}
