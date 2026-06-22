import React from "react";
import { registerRoot, Composition } from "remotion";
import { CleanProductDemo } from "./demo-assets/CleanProductDemo";
import { ProblemSolutionDemo } from "./demo-assets/ProblemSolutionDemo";
import { FeatureWalkthrough } from "./demo-assets/FeatureWalkthrough";
import { SocialProofTeaser } from "./demo-assets/SocialProofTeaser";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="clean-product-demo"
        component={CleanProductDemo as any}
        durationInFrames={300}
        fps={30}
        width={1080}
        height={1920}
      />
      <Composition
        id="problem-solution-demo"
        component={ProblemSolutionDemo as any}
        durationInFrames={300}
        fps={30}
        width={1080}
        height={1920}
      />
      <Composition
        id="feature-walkthrough"
        component={FeatureWalkthrough as any}
        durationInFrames={300}
        fps={30}
        width={1080}
        height={1920}
      />
      <Composition
        id="social-proof-teaser"
        component={SocialProofTeaser as any}
        durationInFrames={300}
        fps={30}
        width={1080}
        height={1920}
      />
    </>
  );
};

registerRoot(RemotionRoot);

