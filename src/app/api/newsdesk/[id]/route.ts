import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { accessErrorResponse } from "@/lib/brand-access";
import {
  approveVariant, markKakaoSent, revokeApproval, setNewsMedia, setVariantText, unlockVariant, type DeskResult,
} from "@/lib/newsdesk/approval";
import { cancelQueued, checkFor, loadItemForCurrentUser, parseMediaInput, publishItem, tickItem, toItemView, type ItemWithVariants } from "@/lib/newsdesk/service";
import { isNewsPlatform, type NewsPlatform } from "@/lib/newsdesk/verify";
import { isRecord } from "@/types/config-normalizers";
import type { Brand } from "@prisma/client";

export const maxDuration = 300;

type Params = { params: Promise<{ id: string }> };

const MAX_VARIANT_TEXT = 5000;

async function view(id: string) {
  const { item, brand } = await loadItemForCurrentUser(id);
  return NextResponse.json({ item: await toItemView(item, brand) });
}

const failure = (result: Extract<DeskResult<unknown>, { ok: false }>) => NextResponse.json({ error: result.error }, { status: result.status });

/** Server-side gate before any approval: the text the operator saw must still be current and pass the checks. */
async function approve(item: ItemWithVariants, brand: Brand, platform: NewsPlatform, revision: unknown): Promise<DeskResult> {
  const variant = item.variants.find((v) => v.platform === platform);
  if (!variant) return { ok: false, status: 404, error: "원고가 없어" };
  if (typeof revision !== "number" || revision !== variant.revision) {
    return { ok: false, status: 409, error: "그새 원고가 바뀌었어. 새로고침해서 다시 확인해줘" };
  }
  const { blockers } = checkFor(item, variant, brand);
  if (blockers.length > 0) return { ok: false, status: 422, error: blockers.join(" · ") };
  return approveVariant(variant.id, revision);
}

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    return await view((await params).id);
  } catch (error) {
    return accessErrorResponse(error) ?? NextResponse.json({ error: "불러오지 못했어" }, { status: 500 });
  }
}

/** PATCH { operatorNote?, media? } — media changes revoke every approval (approval.ts). */
export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const { item } = await loadItemForCurrentUser(id);
    const body: unknown = await request.json().catch(() => null);
    if (!isRecord(body)) return NextResponse.json({ error: "잘못된 요청이야" }, { status: 400 });
    if ("operatorNote" in body) {
      const note = typeof body.operatorNote === "string" ? body.operatorNote.trim().slice(0, 1000) : "";
      await prisma.newsItem.update({ where: { id: item.id }, data: { operatorNote: note || null } });
    }
    if ("media" in body) {
      const media = parseMediaInput(body.media);
      if (!media) return NextResponse.json({ error: "이미지는 업로드한 것만, 최대 5장까지야" }, { status: 400 });
      const result = await setNewsMedia(item.id, media);
      if (!result.ok) return failure(result);
    }
    return await view(id);
  } catch (error) {
    return accessErrorResponse(error) ?? NextResponse.json({ error: "저장하지 못했어" }, { status: 500 });
  }
}

/**
 * POST { action, platform?, text?, revision?, revisions? }
 * edit | approve | revoke | unlock | kakao_sent | cancel take a platform; approve_all takes { revisions: { platform: n } };
 * publish and tick act on the whole item. Every success returns the refreshed item.
 */
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const { item, brand } = await loadItemForCurrentUser(id);
    const body: unknown = await request.json().catch(() => null);
    if (!isRecord(body) || typeof body.action !== "string") return NextResponse.json({ error: "action이 필요해" }, { status: 400 });
    const { action } = body;

    if (action === "publish") {
      const outcomes = await publishItem(item, brand);
      const refreshed = await loadItemForCurrentUser(id);
      return NextResponse.json({ item: await toItemView(refreshed.item, refreshed.brand), outcomes });
    }
    if (action === "tick") {
      await tickItem(id);
      return await view(id);
    }
    if (action === "approve_all") {
      const revisions = isRecord(body.revisions) ? body.revisions : {};
      const errors: string[] = [];
      for (const [platform, revision] of Object.entries(revisions)) {
        if (!isNewsPlatform(platform)) continue;
        const result = await approve(item, brand, platform, revision);
        if (!result.ok) errors.push(`${platform}: ${result.error}`);
      }
      const refreshed = await loadItemForCurrentUser(id);
      return NextResponse.json({ item: await toItemView(refreshed.item, refreshed.brand), errors });
    }

    const platform = body.platform;
    if (!isNewsPlatform(platform)) return NextResponse.json({ error: "platform이 필요해" }, { status: 400 });
    const variant = item.variants.find((v) => v.platform === platform);
    if (!variant) return NextResponse.json({ error: "원고가 없어" }, { status: 404 });

    let result: DeskResult<unknown>;
    switch (action) {
      case "edit": {
        if (typeof body.text !== "string" || body.text.length > MAX_VARIANT_TEXT) {
          return NextResponse.json({ error: `원고는 ${MAX_VARIANT_TEXT}자까지야` }, { status: 400 });
        }
        result = await setVariantText(variant.id, body.text);
        break;
      }
      case "approve":
        result = await approve(item, brand, platform, body.revision);
        break;
      case "revoke":
        result = await revokeApproval(variant.id);
        break;
      case "unlock":
        result = await unlockVariant(id, platform);
        break;
      case "kakao_sent":
        if (platform !== "kakao") return NextResponse.json({ error: "카카오만 직접 보냈다고 표시해" }, { status: 400 });
        result = await markKakaoSent(id);
        break;
      case "cancel":
        result = await cancelQueued(id, platform).then((r) => (r.ok ? { ok: true as const, value: undefined } : r));
        break;
      default:
        return NextResponse.json({ error: "알 수 없는 action이야" }, { status: 400 });
    }
    if (!result.ok) return failure(result);
    return await view(id);
  } catch (error) {
    return accessErrorResponse(error) ?? NextResponse.json({ error: "처리하지 못했어" }, { status: 500 });
  }
}
