import { clampNumber, isRecord, normalizeText } from "./config-normalizers";

export type DemoAssetJobStatus =
  | "QUEUED"
  | "CAPTURING"
  | "PLANNING"
  | "RENDERING"
  | "READY"
  | "FAILED_CAPTURE"
  | "FAILED_PLAN"
  | "FAILED_RENDER"
  | "FAILED_QUALITY";

export const VALID_JOB_STATUSES: DemoAssetJobStatus[] = [
  "QUEUED",
  "CAPTURING",
  "PLANNING",
  "RENDERING",
  "READY",
  "FAILED_CAPTURE",
  "FAILED_PLAN",
  "FAILED_RENDER",
  "FAILED_QUALITY",
];

export type DemoAssetStyle =
  | "clean-product-demo"
  | "problem-solution-demo"
  | "feature-walkthrough"
  | "social-proof-teaser"
  | "both";

export const VALID_ASSET_STYLES: DemoAssetStyle[] = [
  "clean-product-demo",
  "problem-solution-demo",
  "feature-walkthrough",
  "social-proof-teaser",
  "both",
];

export type DemoCaptureArtifactType =
  | "SCREENSHOT_INITIAL"
  | "SCREENSHOT_FULL"
  | "SCREENSHOT_ELEMENT"
  | "TEXT_BLOCKS"
  | "METADATA";

export type DemoCaptureArtifactResponse = {
  id: string;
  jobId: string;
  type: DemoCaptureArtifactType;
  filePath: string;
  metaData: string | null;
  createdAt: string;
};

export type DemoRenderedAssetType = "VIDEO" | "IMAGE";

export type DemoRenderedAssetResponse = {
  id: string;
  jobId: string;
  type: DemoRenderedAssetType;
  style: DemoAssetStyle;
  filePath: string;
  mimeType: string;
  fileSize: number;
  sha256: string;
  metaData: string | null;
  downloadUrl?: string;
  createdAt: string;
};

export interface DemoAssetJobConfig {
  brandId: string;
  productUrl: string;
  productContext?: string;
  style: DemoAssetStyle;
  videoCount: number;
  imageCount: number;
}

export interface DemoAssetJobResponse {
  id: string;
  brandId: string;
  status: DemoAssetJobStatus;
  productUrl: string;
  productContext: string | null;
  style: DemoAssetStyle;
  videoCount: number;
  imageCount: number;
  lockedBy: string | null;
  lockedAt: string | null;
  heartbeatAt: string | null;
  attemptCount: number;
  errorReason: string | null;
  createdAt: string;
  updatedAt: string;
  captureArtifacts?: DemoCaptureArtifactResponse[];
  renderedAssets?: DemoRenderedAssetResponse[];
}

export const DEFAULT_RENDER_TARGET = {
  width: 1080,
  height: 1920,
  fps: 30,
  videoFormat: "mp4",
  imageFormat: "png",
};

export function isValidDemoAssetJobStatus(status: unknown): status is DemoAssetJobStatus {
  return typeof status === "string" && VALID_JOB_STATUSES.includes(status as DemoAssetJobStatus);
}

export function normalizeDemoAssetStyle(style: unknown): DemoAssetStyle {
  if (typeof style === "string" && VALID_ASSET_STYLES.includes(style as DemoAssetStyle)) {
    return style as DemoAssetStyle;
  }
  return "clean-product-demo";
}

export function normalizeDemoAssetJobConfig(input: unknown): DemoAssetJobConfig {
  const raw = isRecord(input) ? input : {};
  const brandId = normalizeText(raw.brandId, "");
  const productUrl = normalizeText(raw.productUrl, "");
  const productContext = typeof raw.productContext === "string" ? raw.productContext : undefined;
  const style = normalizeDemoAssetStyle(raw.style);
  
  // clamp counts to 1-5 videos and 1-12 images
  const videoCount = clampNumber(raw.videoCount, 1, 5, 3);
  const imageCount = clampNumber(raw.imageCount, 1, 12, 6);

  return {
    brandId,
    productUrl,
    productContext,
    style,
    videoCount,
    imageCount,
  };
}
