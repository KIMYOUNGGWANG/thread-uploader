import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, AuthError } from "@/lib/auth";
import { PRODUCT_GROWTH_BASELINE, parseBrandConfig } from "@/types/brand";
import type { ActiveExperiment, BrandConfig, ProductProfile } from "@/types/brand";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasTextField(value: unknown, field: string): boolean {
  return isRecord(value) && typeof value[field] === "string" && value[field].trim().length > 0;
}

export function buildCreateProductConfig(input: unknown, name: string, slug: string): BrandConfig {
  const raw = isRecord(input) ? input : {};
  const parsed = parseBrandConfig(JSON.stringify(raw));
  const rawProductProfile = raw.productProfile;
  const rawActiveExperiment = raw.activeExperiment;
  const rawTikTokVideo = raw.tiktokVideo;
  const hasCampaigns = Array.isArray(raw.campaigns) && raw.campaigns.length > 0;
  const productProfile: ProductProfile = {
    ...parsed.productProfile,
    productName: hasTextField(rawProductProfile, "productName") ? parsed.productProfile.productName : name,
  };
  const activeExperiment: ActiveExperiment = {
    ...parsed.activeExperiment,
    id: hasTextField(rawActiveExperiment, "id") ? parsed.activeExperiment.id : slug,
    name: hasTextField(rawActiveExperiment, "name") ? parsed.activeExperiment.name : `${name} baseline growth loop`,
    primaryMetric: parsed.activeExperiment.primaryMetric || productProfile.primaryMetric,
  };
  const productCampaign = {
    ...PRODUCT_GROWTH_BASELINE,
    landingUrl: productProfile.landingUrl || parsed.websiteUrl,
    utmCampaign: activeExperiment.id,
  };

  return {
    ...parsed,
    productProfile,
    activeExperiment,
    campaigns: hasCampaigns ? parsed.campaigns : [productCampaign],
    activeCampaignId: hasCampaigns ? parsed.activeCampaignId : productCampaign.id,
    qualityProfile: hasCampaigns ? parsed.qualityProfile : "product_growth",
    tiktokVideo: isRecord(rawTikTokVideo)
      ? parsed.tiktokVideo
      : {
        ...parsed.tiktokVideo,
        enabled: false,
        parentCampaignId: productCampaign.id,
        landingUrl: productCampaign.landingUrl,
        formats: [],
      },
  };
}

export async function GET() {
  try {
    const user = await requireAuth();
    const isSuperAdmin = user.email === "admin@example.com";
    
    const brands = await prisma.brand.findMany({
      where: isSuperAdmin ? {} : { ownerId: user.id },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json(
      brands.map((b) => ({
        id: b.id,
        name: b.name,
        slug: b.slug,
        threadsUserId: b.threadsUserId,
        tokenExpiry: b.tokenExpiry.toISOString(),
        brandConfig: parseBrandConfig(b.brandConfig),
        formulaWeights: JSON.parse(b.formulaWeights) as Record<string, number>,
        createdAt: b.createdAt.toISOString(),
        updatedAt: b.updatedAt.toISOString(),
      }))
    );
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "조회 실패" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await request.json() as {
      name?: unknown;
      slug?: unknown;
      accessToken?: unknown;
      threadsUserId?: unknown;
      tokenExpiry?: unknown;
      brandConfig?: unknown;
    };

    const name = typeof body.name === "string" ? body.name.trim() : null;
    const slug = typeof body.slug === "string" ? body.slug.trim().toLowerCase() : null;
    const accessToken = typeof body.accessToken === "string" ? body.accessToken.trim() : null;
    const threadsUserId = typeof body.threadsUserId === "string" ? body.threadsUserId.trim() : null;
    const tokenExpiry = typeof body.tokenExpiry === "string" ? body.tokenExpiry : null;
    const brandConfig = body.brandConfig;

    if (!name || !slug || !accessToken || !threadsUserId || !tokenExpiry) {
      return NextResponse.json({ error: "필수 필드가 누락되었습니다" }, { status: 400 });
    }
    if (!/^[a-z0-9-]+$/.test(slug)) {
      return NextResponse.json({ error: "slug는 영문 소문자, 숫자, 하이픈만 허용됩니다" }, { status: 400 });
    }

    const brand = await prisma.brand.create({
      data: {
        name,
        slug,
        accessToken,
        threadsUserId,
        tokenExpiry: new Date(tokenExpiry),
        brandConfig: JSON.stringify(buildCreateProductConfig(brandConfig, name, slug)),
        ownerId: user.id,
      },
    });

    return NextResponse.json({
      id: brand.id,
      name: brand.name,
      slug: brand.slug,
      threadsUserId: brand.threadsUserId,
      tokenExpiry: brand.tokenExpiry.toISOString(),
      brandConfig: parseBrandConfig(brand.brandConfig),
      formulaWeights: JSON.parse(brand.formulaWeights) as Record<string, number>,
      createdAt: brand.createdAt.toISOString(),
      updatedAt: brand.updatedAt.toISOString(),
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const pgError = error as { code?: string };
    if (pgError.code === "P2002") {
      return NextResponse.json({ error: "이미 사용 중인 slug입니다" }, { status: 409 });
    }
    return NextResponse.json({ error: "제품 생성 실패" }, { status: 500 });
  }
}
