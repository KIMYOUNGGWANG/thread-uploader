import { NextRequest, NextResponse } from "next/server";
import { fetchTrendingNews } from "@/lib/news-rss";

export const maxDuration = 15;

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("query")?.trim() || "인공지능 트렌드";
  const limitParam = parseInt(searchParams.get("limit") || "5", 10);
  const limit = Math.min(10, Math.max(1, isNaN(limitParam) ? 5 : limitParam));

  try {
    const articles = await fetchTrendingNews(query, limit);
    return NextResponse.json({
      success: true,
      query,
      articles,
    });
  } catch (error) {
    console.error("GET /api/news/rss error:", error);
    return NextResponse.json(
      { success: false, error: "뉴스 RSS를 가져오지 못했습니다.", articles: [] },
      { status: 500 }
    );
  }
}
