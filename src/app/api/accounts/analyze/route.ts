import { NextRequest, NextResponse } from "next/server";
import { accessErrorResponse, requireBrandForCurrentUser } from "@/lib/brand-access";
import { analyzeWatchedAccounts } from "@/lib/account-discovery";

interface AnalyzeAccountsRequest {
  brandId?: unknown;
  accountIds?: unknown;
  limit?: unknown;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as AnalyzeAccountsRequest;
    const brandId = typeof body.brandId === "string" ? body.brandId : null;
    if (!brandId) {
      return NextResponse.json({ error: "brandId is required" }, { status: 400 });
    }

    await requireBrandForCurrentUser(brandId);
    return NextResponse.json(await analyzeWatchedAccounts(brandId, {
      accountIds: normalizeStringList(body.accountIds),
      limit: typeof body.limit === "number" ? body.limit : undefined,
    }));
  } catch (error) {
    const response = accessErrorResponse(error);
    if (response) return response;
    console.error("Account analysis error:", error);
    return NextResponse.json({ error: "Failed to analyze accounts" }, { status: 500 });
  }
}

function normalizeStringList(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter(Boolean);
}
