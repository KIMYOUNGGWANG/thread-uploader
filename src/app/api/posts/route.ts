import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ParsedPost, validatePost } from "@/lib/parser";

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

export async function GET(request: NextRequest) {
  try {
    const brandId = request.nextUrl.searchParams.get("brandId");
    if (!brandId) {
      return NextResponse.json({ error: "brandId is required" }, { status: 400 });
    }

    const posts = await prisma.post.findMany({
      where: { brandId },
      orderBy: { scheduledAt: "asc" },
    });

    return NextResponse.json({
      posts: posts.map((p) => ({
        ...p,
        imageUrls: JSON.parse(p.imageUrls) as string[],
        errorLog: normalizeErrorLog(p.status, p.errorLog),
      })),
    });
  } catch (error) {
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

    const brandExists = await prisma.brand.findUnique({ where: { id: brandId } });
    if (!brandExists) {
      return NextResponse.json({ error: "Brand not found" }, { status: 404 });
    }

    const validationResults = posts.map((post, index) => ({ index, ...validatePost(post) }));
    const invalidPosts = validationResults.filter((r) => !r.valid);
    if (invalidPosts.length > 0) {
      return NextResponse.json(
        { error: "Some posts are invalid", details: invalidPosts.map((p) => ({ index: p.index, errors: p.errors })) },
        { status: 400 }
      );
    }

    let baseTime = Date.now();
    if (insertAtFront) {
      const earliest = await prisma.post.findFirst({
        where: { status: "PENDING", brandId },
        orderBy: { scheduledAt: "asc" },
      });
      if (earliest) baseTime = earliest.scheduledAt.getTime() - posts.length * 1000;
    } else {
      const latest = await prisma.post.findFirst({
        where: { status: "PENDING", brandId },
        orderBy: { scheduledAt: "desc" },
      });
      if (latest && latest.scheduledAt.getTime() > Date.now()) {
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
    console.error("Error creating posts:", error);
    return NextResponse.json({ error: "Failed to create posts" }, { status: 500 });
  }
}
