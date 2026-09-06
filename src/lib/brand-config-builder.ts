import {
  PRODUCT_GROWTH_BASELINE,
  parseBrandConfig,
  type ActiveExperiment,
  type BrandConfig,
  type ProductProfile,
} from "@/types/brand";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasTextField(target: unknown, field: string): boolean {
  if (!isRecord(target)) return false;
  const value = target[field];
  return typeof value === "string" && value.trim().length > 0;
}

export function buildCreateProductConfig(input: unknown, name: string, slug: string): BrandConfig {
  const raw = isRecord(input) ? input : {};
  const parsed = parseBrandConfig(JSON.stringify(raw));
  const rawProductProfile = raw.productProfile;
  const rawActiveExperiment = raw.activeExperiment;
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
  };
}
