import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, AuthError } from "@/lib/auth";
import { parseBrandConfig } from "@/types/brand";
import { buildCreateProductConfig } from "@/lib/brand-config-builder";

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
        tokenExpiry: b.tokenExpiry ? b.tokenExpiry.toISOString() : null,
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

    if (!name || !slug) {
      return NextResponse.json({ error: "필수 필드가 누락되었습니다" }, { status: 400 });
    }
    if (!/^[a-z0-9-]+$/.test(slug)) {
      return NextResponse.json({ error: "slug는 영문 소문자, 숫자, 하이픈만 허용됩니다" }, { status: 400 });
    }

    const brand = await prisma.brand.create({
      data: {
        name,
        slug,
        accessToken: accessToken || null,
        threadsUserId: threadsUserId || null,
        tokenExpiry: tokenExpiry ? new Date(tokenExpiry) : null,
        brandConfig: JSON.stringify(buildCreateProductConfig(brandConfig, name, slug)),
        ownerId: user.id,
      },
    });

    return NextResponse.json({
      id: brand.id,
      name: brand.name,
      slug: brand.slug,
      threadsUserId: brand.threadsUserId,
      tokenExpiry: brand.tokenExpiry ? brand.tokenExpiry.toISOString() : null,
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
