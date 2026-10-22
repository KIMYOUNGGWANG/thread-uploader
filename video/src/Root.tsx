// Root.tsx — registers the Shorts / Explainer / Demo compositions.
//
// Each <Composition> reads render-spec.json (passed via `--props`) as input
// props. dimensions/fps/durationInFrames come FROM the render-spec, so we use
// calculateMetadata to override the static defaults at render time. The Zod
// `schema` validates the props, giving the CLI adapter a typed contract: an
// invalid render-spec fails fast (maps to the CLI's SchemaValidationError / exit
// 4) instead of rendering garbage.
import { Composition, type CalculateMetadataFunction } from "remotion";
import { Shorts } from "./compositions/Shorts";
import { Explainer } from "./compositions/Explainer";
import { Demo } from "./compositions/Demo";
import { TikTokExplainer } from "./compositions/TikTokExplainer";
import { IgReels, IG_RANK_SAMPLE_SPEC, IG_PICKCARD_SAMPLE_SPEC } from "./compositions/IgReels";
import { PromoReportTour } from "./compositions/PromoReportTour";
import { PromoRace } from "./compositions/PromoRace";
import { PromoMatch } from "./compositions/PromoMatch";
import { PromoExperiment } from "./compositions/PromoExperiment";
import { previewProps } from "./promo/preview.ts";
import { FORMAT_FRAMES, PROMO_FPS } from "./promo/types.ts";
import {
  RenderSpecSchema,
  PLACEHOLDER_RENDER_SPEC,
  type RenderSpec,
} from "./render-spec";

// Derive real dimensions/fps/duration from the render-spec props.
const calculateMetadata: CalculateMetadataFunction<RenderSpec> = ({ props }) => {
  return {
    width: props.dimensions.width,
    height: props.dimensions.height,
    fps: props.fps,
    durationInFrames: Math.max(1, props.durationInFrames),
  };
};

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="PromoReportTour"
        component={PromoReportTour}
        defaultProps={previewProps("reportTour")}
        width={1080}
        height={1920}
        fps={PROMO_FPS}
        durationInFrames={FORMAT_FRAMES.reportTour}
      />
      <Composition id="PromoRace" component={PromoRace} defaultProps={previewProps("race")}
        width={1080} height={1920} fps={PROMO_FPS} durationInFrames={FORMAT_FRAMES.race} />
      <Composition id="PromoMatch" component={PromoMatch} defaultProps={previewProps("match")}
        width={1080} height={1920} fps={PROMO_FPS} durationInFrames={FORMAT_FRAMES.match} />
      <Composition id="PromoExperiment" component={PromoExperiment} defaultProps={previewProps("experiment")}
        width={1080} height={1920} fps={PROMO_FPS} durationInFrames={FORMAT_FRAMES.experiment} />
      <Composition
        id="TikTokExplainer"
        component={TikTokExplainer}
        schema={RenderSpecSchema}
        defaultProps={{ ...PLACEHOLDER_RENDER_SPEC, composition: "TikTokExplainer" }}
        calculateMetadata={calculateMetadata}
        width={1080}
        height={1920}
        fps={30}
        durationInFrames={90}
      />
      {/* Instagram Reels (manual upload) — formatId ig_rank_10s / ig_pickcard_16s */}
      <Composition
        id="IgRank10s"
        component={IgReels}
        schema={RenderSpecSchema}
        defaultProps={IG_RANK_SAMPLE_SPEC}
        calculateMetadata={calculateMetadata}
        width={1080}
        height={1920}
        fps={30}
        durationInFrames={300}
      />
      <Composition
        id="IgPickCard16s"
        component={IgReels}
        schema={RenderSpecSchema}
        defaultProps={IG_PICKCARD_SAMPLE_SPEC}
        calculateMetadata={calculateMetadata}
        width={1080}
        height={1920}
        fps={30}
        durationInFrames={480}
      />
      <Composition
        id="Shorts"
        component={Shorts}
        schema={RenderSpecSchema}
        defaultProps={{ ...PLACEHOLDER_RENDER_SPEC, composition: "Shorts" }}
        calculateMetadata={calculateMetadata}
        // Static fallbacks (9:16); overridden by calculateMetadata at render.
        width={1080}
        height={1920}
        fps={30}
        durationInFrames={90}
      />
      <Composition
        id="Explainer"
        component={Explainer}
        schema={RenderSpecSchema}
        defaultProps={{
          ...PLACEHOLDER_RENDER_SPEC,
          composition: "Explainer",
          dimensions: { width: 1920, height: 1080 },
        }}
        calculateMetadata={calculateMetadata}
        width={1920}
        height={1080}
        fps={30}
        durationInFrames={90}
      />
      <Composition
        id="Demo"
        component={Demo}
        schema={RenderSpecSchema}
        defaultProps={{
          ...PLACEHOLDER_RENDER_SPEC,
          composition: "Demo",
          dimensions: { width: 1920, height: 1080 },
        }}
        calculateMetadata={calculateMetadata}
        width={1920}
        height={1080}
        fps={30}
        durationInFrames={90}
      />
    </>
  );
};
