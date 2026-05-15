import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ParsedPost, validatePost } from "@/lib/parser";
import { accessErrorResponse, requireBrandForCurrentUser } from "@/lib/brand-access";
import { calculatePerformanceScore, getPerformanceTier } from "@/lib/growth-learning";

interface CreatePostsRequest {
  brandId: string;
  posts: ParsedPost[];
  insertAtFront?: boolean;
}

const FIRST_COMMENT_FAILURE_PREFIX = "First comment failed:";

function normalizeErrorLog(status: string, errorLog: string | null): string | null {
  if (status !== "PUBLISHED" || !errorLog) return errorLog;
  return errorLog.startsWith(FIRST_COMMENT_FAILURE_PREFIX) ? errorLog : null;
}

function parseStringList(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((value): value is string => typeof value === "string")
      : [];
  } catch {
    return [];
  }
}

export async function GET(request: NextRequest) {
  try {
    const brandId = request.nextUrl.searchParams.get("brandId");
    if (!brandId) {
      return NextResponse.json({ error: "brandId is required" }, { status: 400 });
    }

    await requireBrandForCurrentUser(brandId);

    const posts = await prisma.post.findMany({
      where: { brandId },
      orderBy: { scheduledAt: "asc" },
    });

    return NextResponse.json({
      posts: posts.map((p) => ({
        ...p,
        imageUrls: JSON.parse(p.imageUrls) as string[],
        qualityReasons: parseStringList(p.qualityReasons),
        errorLog: normalizeErrorLog(p.status, p.errorLog),
        performanceScore: p.performanceScore ?? (p.views === null ? null : calculatePerformanceScore(p)),
        performanceTier: p.performanceTier ?? (p.views === null ? null : getPerformanceTier(calculatePerformanceScore(p))),
      })),
    });
  } catch (error) {
    const response = accessErrorResponse(error);
    if (response) return response;
    console.error("Error fetching posts:", error);
    return NextResponse.json({ error: "Failed to fetch posts" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as CreatePostsRequest;
    const { brandId, posts, insertAtFront } = body;

    if (!brandId) {
      return NextResponse.json({ error: "brandId is required" }, { status: 400 });
    }
    if (!posts || !Array.isArray(posts) || posts.length === 0) {
      return NextResponse.json({ error: "No posts provided" }, { status: 400 });
    }

    await requireBrandForCurrentUser(brandId);

    const validationResults = posts.map((post, index) => ({ index, ...validatePost(post) }));
    const invalidPosts = validationResults.filter((r) => !r.valid);
    if (invalidPosts.length > 0) {
      return NextResponse.json(
        { error: "Some posts are invalid", details: invalidPosts.map((p) => ({ index: p.index, errors: p.errors })) },
        { status: 400 }
      );
    }

    const now = Date.now();
    let baseTime = now;
    if (insertAtFront) {
      const earliest = await prisma.post.findFirst({
        where: { status: "PENDING", brandId },
        orderBy: { scheduledAt: "asc" },
      });
      if (earliest && earliest.scheduledAt.getTime() > now) {
        baseTime = Math.max(now, earliest.scheduledAt.getTime() - posts.length * 1000);
      }
    } else {
      const latest = await prisma.post.findFirst({
        where: { status: "PENDING", brandId },
        orderBy: { scheduledAt: "desc" },
      });
      if (latest && latest.scheduledAt.getTime() > now) {
        baseTime = latest.scheduledAt.getTime() + 1000;
      }
    }

    const createdPosts = await Promise.all(
      posts.map((post, index) =>
        prisma.post.create({
          data: {
            brandId,
            content: post.content,
            imageUrls: JSON.stringify(post.images),
            scheduledAt: post.scheduledAt ? new Date(post.scheduledAt) : new Date(baseTime + index * 1000),
            status: "PENDING",
            firstComment: post.firstComment ?? null,
          },
        })
      )
    );

    return NextResponse.json({
      success: true,
      count: createdPosts.length,
      posts: createdPosts.map((p) => ({ id: p.id, scheduledAt: p.scheduledAt, status: p.status })),
    });
  } catch (error) {
    const response = accessErrorResponse(error);
    if (response) return response;
    console.error("Error creating posts:", error);
    return NextResponse.json({ error: "Failed to create posts" }, { status: 500 });
  }
}
