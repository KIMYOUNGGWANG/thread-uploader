import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { accessErrorResponse, requireBrandForCurrentUser } from "@/lib/brand-access";
import { createNewsItem } from "@/lib/newsdesk/approval";
import { composeDrafts, composeRaw } from "@/lib/newsdesk/compose";
import { MAX_SOURCE_TEXT } from "@/lib/newsdesk/scrape";
import { parseMediaInput, toItemView } from "@/lib/newsdesk/service";
import { normalizeUrl } from "@/lib/wellness/articles";
import { isRecord } from "@/types/config-normalizers";

export const maxDuration = 300;

const optionalText = (value: unknown, max: number): string | null =>
  typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null;

/** GET /api/newsdesk?brandId= — recent items for the side list. */
export async function GET(request: NextRequest) {
  try {
    const brandId = request.nextUrl.searchParams.get("brandId");
    if (!brandId) return NextResponse.json({ error: "brandId가 필요해" }, { status: 400 });
    await requireBrandForCurrentUser(brandId);
    const items = await prisma.newsItem.findMany({
      where: { brandId },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { id: true, sourceTitle: true, sourceText: true, createdAt: true, variants: { select: { platform: true, lockedAt: true } } },
    });
    return NextResponse.json({
      items: items.map((item) => ({
        id: item.id,
        title: item.sourceTitle ?? item.sourceText.slice(0, 60),
        createdAt: item.createdAt.toISOString(),
        sent: item.variants.filter((v) => v.lockedAt).map((v) => v.platform),
      })),
    });
  } catch (error) {
    return accessErrorResponse(error) ?? NextResponse.json({ error: "목록을 불러오지 못했어" }, { status: 500 });
  }
}

/** POST /api/newsdesk { brandId, sourceText, sourceUrl?, sourceTitle?, rawMode?, operatorNote?, media? } — drafts every platform. */
export async function POST(request: NextRequest) {
  try {
    const body: unknown = await request.json().catch(() => null);
    if (!isRecord(body) || typeof body.brandId !== "string") return NextResponse.json({ error: "brandId가 필요해" }, { status: 400 });
    const { brand } = await requireBrandForCurrentUser(body.brandId);

    const sourceText = optionalText(body.sourceText, MAX_SOURCE_TEXT);
    if (!sourceText) return NextResponse.json({ error: "기사 본문이나 원문을 넣어줘" }, { status: 400 });
    const media = parseMediaInput(body.media ?? []);
    if (!media) return NextResponse.json({ error: "이미지는 업로드한 것만, 최대 5장까지야" }, { status: 400 });
    const rawUrl = optionalText(body.sourceUrl, 2000);
    const sourceUrl = rawUrl && /^https?:\/\//i.test(rawUrl) ? normalizeUrl(rawUrl) : null;
    const sourceTitle = optionalText(body.sourceTitle, 300);
    const operatorNote = optionalText(body.operatorNote, 1000);
    const rawMode = body.rawMode === true;

    let composed;
    try {
      composed = rawMode
        ? composeRaw(sourceText)
        : await composeDrafts({ title: sourceTitle, url: sourceUrl, text: sourceText, operatorNote, imageCount: media.length });
    } catch (error) {
      console.error("[newsdesk] compose failed:", error instanceof Error ? error.message : error);
      composed = null;
    }
    if (!composed) {
      return NextResponse.json({ error: "원고를 못 만들었어. 다시 시도하거나 'AI 가공 없이 원문 그대로'로 만들어줘" }, { status: 502 });
    }

    const item = await createNewsItem(
      { brandId: brand.id, sourceUrl, sourceTitle, sourceText, rawMode, operatorNote, facts: JSON.stringify(composed.facts), media: JSON.stringify(media) },
      composed.drafts,
    );
    return NextResponse.json({ item: await toItemView(item, brand) }, { status: 201 });
  } catch (error) {
    return accessErrorResponse(error) ?? NextResponse.json({ error: "기사를 만들지 못했어" }, { status: 500 });
  }
}
