import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition, renderStill } from "@remotion/renderer";
import type { RemotionRenderProps } from "./render-plan";

// ---------------------------------------------------------------------------
// Bundle cache to avoid rebundling for every file in the worker lifecycle
// ---------------------------------------------------------------------------

let cachedBundleLocation: string | null = null;

async function getBundleLocation(): Promise<string> {
  if (cachedBundleLocation) {
    return cachedBundleLocation;
  }

  const entryPoint = path.join(process.cwd(), "src/remotion/index.tsx");
  
  // Create bundle of React compositions
  cachedBundleLocation = await bundle({
    entryPoint,
  });

  return cachedBundleLocation;
}

// ---------------------------------------------------------------------------
// Render result type
// ---------------------------------------------------------------------------

export interface RenderResult {
  outputPath: string;
  fileSize: number;
  sha256: string;
}

// ---------------------------------------------------------------------------
// Video renderer
// ---------------------------------------------------------------------------

/**
 * Renders a video using Remotion renderProps and bundles React compositions.
 */
export async function renderVideo(
  renderProps: RemotionRenderProps,
  outputDir: string,
  videoIndex: number,
): Promise<RenderResult> {
  await fs.mkdir(outputDir, { recursive: true });

  const outputPath = path.join(
    outputDir,
    `video_${renderProps.inputProps.style}_${videoIndex}.mp4`,
  );

  const bundleLocation = await getBundleLocation();

  // Select composition by style ID
  const composition = await selectComposition({
    serveUrl: bundleLocation,
    id: renderProps.inputProps.style,
    inputProps: renderProps.inputProps as unknown as Record<string, unknown>,
  });

  // Render to MP4
  await renderMedia({
    composition,
    serveUrl: bundleLocation,
    codec: "h264",
    outputLocation: outputPath,
    inputProps: renderProps.inputProps as unknown as Record<string, unknown>,
    chromiumOptions: {
      disableWebSecurity: true,
    },
  });

  // Calculate file metadata
  const fileBuffer = await fs.readFile(outputPath);
  const fileSize = fileBuffer.length;
  const sha256 = crypto.createHash("sha256").update(fileBuffer).digest("hex");

  return { outputPath, fileSize, sha256 };
}

// ---------------------------------------------------------------------------
// Image renderer
// ---------------------------------------------------------------------------

/**
 * Renders a still image using Remotion renderProps.
 */
export async function renderImage(
  renderProps: RemotionRenderProps,
  outputDir: string,
  imageIndex: number,
): Promise<RenderResult> {
  await fs.mkdir(outputDir, { recursive: true });

  const outputPath = path.join(
    outputDir,
    `image_${renderProps.inputProps.style}_${imageIndex}.png`,
  );

  const bundleLocation = await getBundleLocation();

  const composition = await selectComposition({
    serveUrl: bundleLocation,
    id: renderProps.inputProps.style,
    inputProps: renderProps.inputProps as unknown as Record<string, unknown>,
  });

  // Render the first frame as still PNG image
  await renderStill({
    composition,
    serveUrl: bundleLocation,
    output: outputPath,
    frame: 0,
    inputProps: renderProps.inputProps as unknown as Record<string, unknown>,
    chromiumOptions: {
      disableWebSecurity: true,
    },
  });

  const fileBuffer = await fs.readFile(outputPath);
  const fileSize = fileBuffer.length;
  const sha256 = crypto.createHash("sha256").update(fileBuffer).digest("hex");

  return { outputPath, fileSize, sha256 };
}
