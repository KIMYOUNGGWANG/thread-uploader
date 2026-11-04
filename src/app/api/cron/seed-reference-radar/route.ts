import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyCronSecret } from "@/lib/cron-auth";
import { lookupThreadsUsername, planRadarSeed } from "@/lib/reference-radar-seed";
import { parseBrandConfig, serializeBrandConfigUpdate } from "@/types/brand";

// Server-side twin of scripts/seed-reference-radar.ts for operators without a local .env.
// Preview by default; apply=true writes. Fills empty keywords / ownHandle only, never overwrites.
export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const slug = request.nextUrl.searchParams.get("brand")?.trim();
  // The keyword list is saju-specific; another product needs its own list, not this one.
  if (slug !== "cosmicpath") return NextResponse.json({ error: "seed-reference-radar supports cosmicpath only" }, { status: 400 });
  const apply = request.nextUrl.searchParams.get("apply") === "true";

  const brand = await prisma.brand.findUnique({
    where: { slug },
    select: { id: true, brandConfig: true, threadsUserId: true },
  });
  if (!brand) return NextResponse.json({ error: `Brand not found: ${slug}` }, { status: 404 });

  const current = parseBrandConfig(brand.brandConfig).viralDiscovery;
  const ownHandle = current.ownHandle ? undefined : await lookupThreadsUsername(brand.id, brand.threadsUserId);
  const changes = planRadarSeed(current, ownHandle);
  const changed = Object.keys(changes);

  if (apply && changed.length > 0) {
    await prisma.brand.update({
      where: { id: brand.id },
      data: { brandConfig: serializeBrandConfigUpdate(brand.brandConfig, { viralDiscovery: { ...current, ...changes } }) },
    });
  }
  return NextResponse.json({
    brand: slug,
    apply,
    changes,
    written: apply && changed.length > 0,
    keywords: changes.keywords ?? current.keywords,
    ownHandle: changes.ownHandle ?? current.ownHandle ?? null,
  });
}
