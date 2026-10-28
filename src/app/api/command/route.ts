import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { accessErrorResponse, requireBrandForCurrentUser } from "@/lib/brand-access";
import { interpretCommand, parseCommandPlan } from "@/lib/command-plan";
import { generatePostsForBrand } from "@/lib/generate-posts";
import { parseBrandConfig, serializeBrandConfigUpdate } from "@/types/brand";

export const maxDuration = 300;

/**
 * One-line command → plan → drafts. `{ text }` only returns the plan (no side effects);
 * `{ plan, approved: true }` writes the hypothesis into the brand's active experiment and queues drafts.
 * Campaign starts are never approved here, so drafts still land in NEEDS_REVIEW like the refill cron.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { text?: unknown; plan?: unknown; approved?: unknown };
    const user = await requireAuth();
    const brands = await prisma.brand.findMany({ where: { ownerId: user.id }, select: { id: true, slug: true, name: true } });

    if (body.approved !== true) {
      if (typeof body.text !== "string") return NextResponse.json({ error: "text is required" }, { status: 400 });
      const plan = await interpretCommand(body.text, brands);
      const brand = brands.find((candidate) => candidate.id === plan.brandId);
      return NextResponse.json({ plan, brandSlug: brand?.slug ?? null });
    }

    const plan = parseCommandPlan(body.plan, brands);
    if (!plan) return NextResponse.json({ error: "plan is invalid" }, { status: 400 });
    let { brand } = await requireBrandForCurrentUser(plan.brandId);
    if (plan.hypothesis) {
      const config = parseBrandConfig(brand.brandConfig);
      brand = await prisma.brand.update({
        where: { id: brand.id },
        data: {
          brandConfig: serializeBrandConfigUpdate(brand.brandConfig, {
            activeExperiment: { ...config.activeExperiment, hypothesis: plan.hypothesis },
          }),
        },
      });
    }

    const result = await generatePostsForBrand(brand, {
      count: plan.count,
      insertAtFront: false,
      requestedCampaignId: null,
      approvedCampaignStart: false,
      postCategory: "GROWTH",
    });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ success: true, plan, ...result.summary });
  } catch (error) {
    const response = accessErrorResponse(error);
    if (response) return response;
    return NextResponse.json({ error: error instanceof Error ? error.message : "명령 처리 실패" }, { status: 500 });
  }
}
