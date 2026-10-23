import { prisma } from "@/lib/prisma";
import { buildTrackedUrl } from "@/lib/tracking-url";
import { parseBrandConfig, serializeBrandConfigUpdate } from "@/types/brand";

export const INSTAGRAM_BIO_ANCHOR_STATUS = "ANCHOR";
export const INSTAGRAM_BIO_CATEGORY = "INSTAGRAM_BIO";

// One placeholder Post per brand: the bio link carries its id as `pid` so bio clicks/conversions attribute to it.
export async function ensureInstagramBioAnchor(brandId: string): Promise<string> {
  const brand = await prisma.brand.findUniqueOrThrow({ where: { id: brandId } });
  const config = parseBrandConfig(brand.brandConfig);
  const storedId = config.instagram.bioAnchorPostId;

  if (storedId && (await prisma.post.findUnique({ where: { id: storedId }, select: { id: true } }))) {
    return storedId;
  }

  const anchor = await prisma.post.create({
    data: {
      brandId,
      content: "[instagram bio anchor]",
      scheduledAt: new Date(),
      status: INSTAGRAM_BIO_ANCHOR_STATUS,
      postCategory: INSTAGRAM_BIO_CATEGORY,
    },
  });
  await prisma.brand.update({
    where: { id: brandId },
    data: {
      brandConfig: serializeBrandConfigUpdate(brand.brandConfig, {
        instagram: { ...config.instagram, bioAnchorPostId: anchor.id },
      }),
    },
  });
  return anchor.id;
}

const URL_SCHEME_PATTERN = /^[a-z][a-z0-9+.-]*:\/\//i;

// The AI tab allows a bare domain ("invoiceflow.app"), so default to https when no scheme is present.
export function buildInstagramBioLink(websiteUrl: string, anchorPostId: string): string {
  const baseUrl = URL_SCHEME_PATTERN.test(websiteUrl) ? websiteUrl : `https://${websiteUrl}`;
  return buildTrackedUrl(new URL("/start", baseUrl).toString(), {
    postId: anchorPostId,
    source: "instagram",
    utmSource: "instagram",
    utmCampaign: "instagram_bio",
  });
}

// For display paths (settings page): an unusable website URL means "no link yet", never an error.
export function tryBuildInstagramBioLink(websiteUrl: string, anchorPostId: string | undefined): string | null {
  if (!anchorPostId || !websiteUrl.trim()) return null;
  try {
    return buildInstagramBioLink(websiteUrl.trim(), anchorPostId);
  } catch {
    return null;
  }
}
