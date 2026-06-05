import { NextResponse } from "next/server";
import {
  buildProductAutoSetupDraft,
  parseProductAutoSetupInput,
} from "@/lib/product-auto-setup";

export async function POST(request: Request) {
  try {
    const payload: unknown = await request.json();
    const input = parseProductAutoSetupInput(payload);
    return NextResponse.json(buildProductAutoSetupDraft(input));
  } catch {
    return NextResponse.json({ error: "자동 세팅 입력을 읽지 못했습니다" }, { status: 400 });
  }
}
