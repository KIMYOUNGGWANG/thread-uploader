import { prisma } from "@/lib/prisma";
import { parseBrandConfig } from "@/types/brand";
import { kstDate } from "./kst";
import { pickClip } from "./clip-picker";
import { generateKineticListScript } from "./generate-kinetic-list";
import { checkKineticListScript, type KineticListScript } from "./kinetic-list-script";
import { buildKineticListVariables } from "./render-variables";

export interface FactoryJob {
  draftId: string;
  brandSlug: string;
  variables: Record<string, string>;
  blobPrefix: string;
}

export type CompleteInput =
  | { draftId: string; videoUrl: string; coverUrl: string }
  | { draftId: string; errors: string[] };

export const STALE_RENDER_MS = 30 * 60 * 1000;
export const MAX_DRAFTS_PER_DAY = 3;
const RECENT_DRAFTS = 14;
const FORMAT_ID = "kinetic_list";

type BrandRef = { id: string; slug: string; name: string; brandConfig: string };

const toJob = (draftId: string, brandSlug: string, script: KineticListScript, hookSrc: string | null): FactoryJob => ({
  draftId,
  brandSlug,
  variables: buildKineticListVariables(script, hookSrc),
  blobPrefix: `videos/factory/${brandSlug}/${draftId}`,
});

/** 렌더러가 죽어서 RENDERING으로 남은 초안을 QUEUED로 되돌린다. */
export async function requeueStaleRenders(now: Date): Promise<number> {
  const { count } = await prisma.videoDraft.updateMany({
    where: { status: "RENDERING", updatedAt: { lt: new Date(now.getTime() - STALE_RENDER_MS) } },
    data: { status: "QUEUED" },
  });
  return count;
}

function parseScript(raw: string): KineticListScript | null {
  try {
    const checked = checkKineticListScript(JSON.parse(raw) as unknown, []);
    return checked.ok ? checked.script : null;
  } catch {
    return null;
  }
}

function hookText(raw: string): string | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    const lines = (parsed as { hook?: { lines?: unknown } } | null)?.hook?.lines;
    return Array.isArray(lines) && lines.every((l) => typeof l === "string") ? lines.join(" ") : null;
  } catch {
    return null;
  }
}

async function claimQueuedDraft(brand: BrandRef): Promise<FactoryJob | null> {
  const queued = await prisma.videoDraft.findFirst({
    where: { brandId: brand.id, status: "QUEUED" },
    orderBy: { createdAt: "asc" },
    include: { clipAsset: true },
  });
  if (!queued) return null;
  const claimed = await prisma.videoDraft.updateMany({
    where: { id: queued.id, status: "QUEUED" },
    data: { status: "RENDERING" },
  });
  if (claimed.count !== 1) return null;
  const script = parseScript(queued.script);
  if (!script) {
    await prisma.videoDraft.update({
      where: { id: queued.id },
      data: { status: "FAILED", renderErrors: JSON.stringify(["stored script is invalid"]) },
    });
    return null;
  }
  return toJob(queued.id, brand.slug, script, queued.clipAsset?.fileUrl ?? null);
}

export async function claimOrCreateDraft(brand: BrandRef, now: Date, force: boolean): Promise<FactoryJob | null> {
  const queued = await claimQueuedDraft(brand);
  if (queued) return queued;

  const today = kstDate(now);
  const todays = force
    ? await prisma.videoDraft.count({ where: { brandId: brand.id, kstDate: today } })
    : await prisma.videoDraft.count({
        where: { brandId: brand.id, kstDate: today, status: { in: ["COMPLETED", "RENDERING"] } },
      });
  if (force ? todays >= MAX_DRAFTS_PER_DAY : todays > 0) return null;

  const recent = await prisma.videoDraft.findMany({
    where: { brandId: brand.id },
    orderBy: { createdAt: "desc" },
    take: RECENT_DRAFTS,
    select: { script: true },
  });
  const recentHooks = recent.flatMap((d) => hookText(d.script) ?? []);

  let errors: string[];
  try {
    const result = await generateKineticListScript({
      brandName: brand.name,
      qualityProfile: parseBrandConfig(brand.brandConfig).qualityProfile,
      recentHooks,
      kstDate: today,
    });
    if (result.ok) {
      const clips = await prisma.clipAsset.findMany({ where: { brandId: brand.id, enabled: true } });
      const clip = pickClip(clips, now);
      const draft = await prisma.videoDraft.create({
        data: {
          brandId: brand.id,
          formatId: FORMAT_ID,
          status: "RENDERING",
          kstDate: today,
          script: JSON.stringify(result.script),
          captions: JSON.stringify(result.script.captions),
          hashtags: JSON.stringify(result.script.hashtags),
          voiceMode: "bgm_only",
          clipAssetId: clip?.id ?? null,
        },
      });
      return toJob(draft.id, brand.slug, result.script, clip?.fileUrl ?? null);
    }
    errors = result.errors;
  } catch (error) {
    errors = [`generate: ${error instanceof Error ? error.message : String(error)}`];
  }

  await prisma.videoDraft.create({
    data: {
      brandId: brand.id,
      formatId: FORMAT_ID,
      status: "FAILED",
      kstDate: today,
      renderErrors: JSON.stringify(errors),
    },
  });
  return null;
}

export async function completeDraft(input: CompleteInput): Promise<"ok" | "not_found" | "conflict"> {
  const succeeded = "videoUrl" in input;
  return prisma.$transaction(async (tx) => {
    const { count } = await tx.videoDraft.updateMany({
      where: { id: input.draftId, status: "RENDERING" },
      data: succeeded
        ? { status: "COMPLETED", videoUrl: input.videoUrl, coverUrl: input.coverUrl }
        : { status: "FAILED", renderErrors: JSON.stringify(input.errors) },
    });
    if (count === 0) {
      const exists = await tx.videoDraft.findUnique({ where: { id: input.draftId }, select: { id: true } });
      return exists ? "conflict" : "not_found";
    }
    if (succeeded) {
      const draft = await tx.videoDraft.findUnique({ where: { id: input.draftId }, select: { clipAssetId: true } });
      if (draft?.clipAssetId) {
        await tx.clipAsset.update({
          where: { id: draft.clipAssetId },
          data: { usedCount: { increment: 1 }, lastUsedAt: new Date() },
        });
      }
    }
    return "ok";
  });
}
