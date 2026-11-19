import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { accessErrorResponse, requireBrandForCurrentUser } from "@/lib/brand-access";
import { scrapeArticle, ScrapeError } from "@/lib/newsdesk/scrape";
import { isRecord } from "@/types/config-normalizers";

export const maxDuration = 30;

/** POST /api/newsdesk/scrape { brandId, url } — fetches an article (SSRF-checked) and lists earlier items from the same URL. */
export async function POST(request: NextRequest) {
  try {
    const body: unknown = await request.json().catch(() => null);
    if (!isRecord(body) || typeof body.brandId !== "string" || typeof body.url !== "string") {
      return NextResponse.json({ error: "brandId와 url이 필요해" }, { status: 400 });
    }
    await requireBrandForCurrentUser(body.brandId);
    const article = await scrapeArticle(body.url);
    const earlier = await prisma.newsItem.findMany({
      where: { brandId: body.brandId, sourceUrl: article.url },
      orderBy: { createdAt: "desc" },
      take: 3,
      select: { id: true, createdAt: true },
    });
    return NextResponse.json({
      article: { url: article.url, title: article.title, text: article.text, imageUrl: article.imageUrl },
      earlier: earlier.map((item) => ({ id: item.id, createdAt: item.createdAt.toISOString() })),
    });
  } catch (error) {
    if (error instanceof ScrapeError) return NextResponse.json({ error: error.message }, { status: 422 });
    return accessErrorResponse(error) ?? NextResponse.json({ error: "기사를 가져오지 못했어" }, { status: 500 });
  }
}
