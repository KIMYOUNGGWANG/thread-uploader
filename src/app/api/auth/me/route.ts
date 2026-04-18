import { NextResponse } from "next/server";
import { requireAuth, AuthError } from "@/lib/auth";

export async function GET() {
  try {
    const user = await requireAuth();
    return NextResponse.json(user);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "오류가 발생했습니다" }, { status: 500 });
  }
}
