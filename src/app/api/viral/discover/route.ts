import { NextRequest, NextResponse } from "next/server";
import { accessErrorResponse, requireBrandForCurrentUser } from "@/lib/brand-access";
import { discoverViralExamples } from "@/lib/viral-service";
import type { ManualViralExample } from "@/types/viral";

interface DiscoverRequest {
  brandId?: unknown;
  useSavedSources?: unknown;
  keywords?: unknown;
  handles?: unknown;
  includeOwnPosts?: unknown;
  manualExamples?: unknown;
  limit?: unknown;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as DiscoverRequest;
    const brandId = typeof body.brandId === "string" ? body.brandId : null;
    if (!brandId) {
      return NextResponse.json({ error: "brandId is required" }, { status: 400 });
    }

    await requireBrandForCurrentUser(brandId);
    const result = await discoverViralExamples(brandId, {
      useSavedSources: body.useSavedSources !== false,
      keywords: normalizeStringList(body.keywords),
      handles: normalizeStringList(body.handles),
      includeOwnPosts: typeof body.includeOwnPosts === "boolean" ? body.includeOwnPosts : undefined,
      manualExamples: normalizeManualExamples(body.manualExamples),
      limit: typeof body.limit === "number" ? body.limit : undefined,
    });

    return NextResponse.json(result);
  } catch (error) {
    const response = accessErrorResponse(error);
    if (response) return response;
    console.error("Viral discover error:", error);
    return NextResponse.json({ error: "Failed to discover viral examples" }, { status: 500 });
  }
}

function normalizeStringList(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter(Boolean);
}

function normalizeManualExamples(input: unknown): ManualViralExample[] {
  if (!Array.isArray(input)) return [];

  return input.flatMap((item): ManualViralExample[] => {
    if (typeof item !== "object" || item === null) return [];
    const example = item as Record<string, unknown>;
    if (typeof example.content !== "string" || !example.content.trim()) return [];

    return [{
      content: example.content,
      authorUsername: typeof example.authorUsername === "string" ? example.authorUsername : undefined,
      permalink: typeof example.permalink === "string" ? example.permalink : undefined,
      publishedAt: typeof example.publishedAt === "string" ? example.publishedAt : undefined,
      views: normalizeNumber(example.views),
      likes: normalizeNumber(example.likes),
      replies: normalizeNumber(example.replies),
      reposts: normalizeNumber(example.reposts),
      quotes: normalizeNumber(example.quotes),
      shares: normalizeNumber(example.shares),
    }];
  });
}

function normalizeNumber(input: unknown): number | undefined {
  return typeof input === "number" && Number.isFinite(input) && input >= 0
    ? Math.round(input)
    : undefined;
}
