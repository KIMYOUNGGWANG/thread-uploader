import { NextRequest, NextResponse } from "next/server";
import { accessErrorResponse, requireBrandForCurrentUser } from "@/lib/brand-access";
import { getDiscoveredAccounts } from "@/lib/account-discovery";
import type { DiscoveredAccountStatus } from "@/types/account-discovery";

export async function GET(request: NextRequest) {
  try {
    const brandId = request.nextUrl.searchParams.get("brandId");
    const status = parseStatus(request.nextUrl.searchParams.get("status"));
    if (!brandId) {
      return NextResponse.json({ error: "brandId is required" }, { status: 400 });
    }

    await requireBrandForCurrentUser(brandId);
    return NextResponse.json(await getDiscoveredAccounts(brandId, status));
  } catch (error) {
    const response = accessErrorResponse(error);
    if (response) return response;
    console.error("Accounts load error:", error);
    return NextResponse.json({ error: "Failed to load accounts" }, { status: 500 });
  }
}

function parseStatus(value: string | null): DiscoveredAccountStatus | undefined {
  if (value === "candidate" || value === "watched" || value === "ignored") return value;
  return undefined;
}
