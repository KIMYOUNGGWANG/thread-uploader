import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyCronSecret } from "@/lib/cron-auth";
import { TOPIC_PLANS } from "@/lib/topic-plans";
import { parseBrandConfig, serializeBrandConfigUpdate } from "@/types/brand";

// Writes the code-reviewed topic list (src/lib/topic-plans.ts) into brandConfig.topics.
// Preview by default; apply=true writes. The previous list is kept in previousTopics so it can be restored.
export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const slug = request.nextUrl.searchParams.get("brand")?.trim() ?? "";
  const plan = TOPIC_PLANS[slug];
  if (!plan) return NextResponse.json({ error: `No topic plan for brand: ${slug || "(none)"}` }, { status: 400 });
  const apply = request.nextUrl.searchParams.get("apply") === "true";

  const brand = await prisma.brand.findUnique({ where: { slug }, select: { id: true, brandConfig: true } });
  if (!brand) return NextResponse.json({ error: `Brand not found: ${slug}` }, { status: 404 });

  const current = parseBrandConfig(brand.brandConfig).topics;
  const unchanged = current.length === plan.length && current.every((topic, index) => topic === plan[index]);
  if (apply && !unchanged) {
    await prisma.brand.update({
      where: { id: brand.id },
      data: { brandConfig: serializeBrandConfigUpdate(brand.brandConfig, { topics: [...plan], previousTopics: current }) },
    });
  }
  return NextResponse.json({ brand: slug, apply, written: apply && !unchanged, previous: current, next: plan });
}
