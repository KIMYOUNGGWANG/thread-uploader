import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, AuthError } from "@/lib/auth";
import { parseBrandConfig } from "@/types/brand";
import type { BrandConfig } from "@/types/brand";

async function getBrandForUser(id: string, user: { id: string; email: string }) {
  const brand = await prisma.brand.findUnique({ where: { id } });
  if (!brand) return null;
  
  const isSuperAdmin = user.email === "admin@example.com";
  if (!isSuperAdmin && brand.ownerId !== user.id) return null;
  
  return brand;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    const brand = await getBrandForUser(id, user);
    if (!brand) {
      return NextResponse.json({ error: "브랜드를 찾을 수 없습니다" }, { status: 404 });
    }
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
    return NextResponse.json({ error: "조회 실패" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    const brand = await getBrandForUser(id, user);
    if (!brand) {
      return NextResponse.json({ error: "브랜드를 찾을 수 없습니다" }, { status: 404 });
    }

    const body = await request.json() as {
      name?: unknown;
      accessToken?: unknown;
      threadsUserId?: unknown;
      tokenExpiry?: unknown;
      brandConfig?: unknown;
      formulaWeights?: unknown;
    };

    const currentConfig = parseBrandConfig(brand.brandConfig);
    const incomingConfig = body.brandConfig as Partial<BrandConfig> | undefined;
    const mergedConfig = incomingConfig
      ? { ...currentConfig, ...incomingConfig }
      : currentConfig;

    const updated = await prisma.brand.update({
      where: { id },
      data: {
        ...(typeof body.name === "string" && { name: body.name.trim() }),
        ...(typeof body.accessToken === "string" && { accessToken: body.accessToken }),
        ...(typeof body.threadsUserId === "string" && { threadsUserId: body.threadsUserId }),
        ...(typeof body.tokenExpiry === "string" && { tokenExpiry: new Date(body.tokenExpiry) }),
        brandConfig: JSON.stringify(mergedConfig),
        ...(body.formulaWeights !== undefined && {
          formulaWeights: JSON.stringify(body.formulaWeights),
        }),
      },
    });

    return NextResponse.json({
      id: updated.id,
      name: updated.name,
      slug: updated.slug,
      threadsUserId: updated.threadsUserId,
      tokenExpiry: updated.tokenExpiry.toISOString(),
      brandConfig: parseBrandConfig(updated.brandConfig),
      formulaWeights: JSON.parse(updated.formulaWeights) as Record<string, number>,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "브랜드 수정 실패" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    const brand = await getBrandForUser(id, user);
    if (!brand) {
      return NextResponse.json({ error: "브랜드를 찾을 수 없습니다" }, { status: 404 });
    }

    await prisma.brand.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "브랜드 삭제 실패" }, { status: 500 });
  }
}
