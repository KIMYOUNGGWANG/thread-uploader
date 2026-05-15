import { NextRequest, NextResponse } from "next/server";
import { accessErrorResponse, requireBrandForCurrentUser } from "@/lib/brand-access";
import { discoverAccounts } from "@/lib/account-discovery";

interface DiscoverAccountsRequest {
  brandId?: unknown;
  keywords?: unknown;
  limit?: unknown;
  minScore?: unknown;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as DiscoverAccountsRequest;
    const brandId = typeof body.brandId === "string" ? body.brandId : null;
    if (!brandId) {
      return NextResponse.json({ error: "brandId is required" }, { status: 400 });
    }

    await requireBrandForCurrentUser(brandId);
    return NextResponse.json(await discoverAccounts(brandId, {
      keywords: normalizeStringList(body.keywords),
      limit: typeof body.limit === "number" ? body.limit : undefined,
      minScore: typeof body.minScore === "number" ? body.minScore : undefined,
    }));
  } catch (error) {
    const response = accessErrorResponse(error);
    if (response) return response;
    console.error("Account discovery error:", error);
    return NextResponse.json({ error: "Failed to discover accounts" }, { status: 500 });
  }
}

function normalizeStringList(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter(Boolean);
}
