import React, { type ComponentType } from "react";
import { registerRoot, Composition } from "remotion";
import { CleanProductDemo } from "./demo-assets/CleanProductDemo";
import { ProblemSolutionDemo } from "./demo-assets/ProblemSolutionDemo";
import { FeatureWalkthrough } from "./demo-assets/FeatureWalkthrough";
import { SocialProofTeaser } from "./demo-assets/SocialProofTeaser";
import type { RemotionInputProps } from "../lib/demo-assets/render-plan";

const DEFAULT_PROPS: RemotionInputProps = {
  jobId: "preview",
  style: "clean-product-demo",
  colorTheme: {
    primary: "#6366f1",
    secondary: "#a855f7",
    background: "#0f172a",
    textPrimary: "#f8fafc",
    textSecondary: "#94a3b8",
  },
  typography: {
    headlineFont: "sans-serif",
    bodyFont: "sans-serif",
  },
  productInfo: {
    title: "Preview Product",
    description: "Preview Description",
    ctaText: "Get Started",
  },
  sequences: [],
};

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="clean-product-demo"
        component={CleanProductDemo as ComponentType<RemotionInputProps>}
        durationInFrames={300}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={DEFAULT_PROPS}
      />
      <Composition
        id="problem-solution-demo"
        component={ProblemSolutionDemo as ComponentType<RemotionInputProps>}
        durationInFrames={300}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{ ...DEFAULT_PROPS, style: "problem-solution-demo" }}
      />
      <Composition
        id="feature-walkthrough"
        component={FeatureWalkthrough as ComponentType<RemotionInputProps>}
        durationInFrames={300}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{ ...DEFAULT_PROPS, style: "feature-walkthrough" }}
      />
      <Composition
        id="social-proof-teaser"
        component={SocialProofTeaser as ComponentType<RemotionInputProps>}
        durationInFrames={300}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{ ...DEFAULT_PROPS, style: "social-proof-teaser" }}
      />
    </>
  );
};

registerRoot(RemotionRoot);
