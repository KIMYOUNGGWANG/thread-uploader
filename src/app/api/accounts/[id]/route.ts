import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { accessErrorResponse, requireBrandForCurrentUser, ResourceNotFoundError } from "@/lib/brand-access";
import { updateDiscoveredAccountStatus } from "@/lib/account-discovery";
import type { DiscoveredAccountStatus } from "@/types/account-discovery";

interface RouteParams {
  params: Promise<{ id: string }>;
}

interface UpdateAccountRequest {
  status?: unknown;
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const account = await prisma.discoveredAccount.findUnique({ where: { id } });
    if (!account) throw new ResourceNotFoundError("Account not found");

    await requireBrandForCurrentUser(account.brandId);
    const body = await request.json() as UpdateAccountRequest;
    const status = parseStatus(body.status);
    if (!status) {
      return NextResponse.json({ error: "status must be candidate, watched, or ignored" }, { status: 400 });
    }

    return NextResponse.json({ success: true, account: await updateDiscoveredAccountStatus(id, status) });
  } catch (error) {
    const response = accessErrorResponse(error);
    if (response) return response;
    console.error("Account update error:", error);
    return NextResponse.json({ error: "Failed to update account" }, { status: 500 });
  }
}

function parseStatus(input: unknown): DiscoveredAccountStatus | null {
  return input === "candidate" || input === "watched" || input === "ignored" ? input : null;
}
