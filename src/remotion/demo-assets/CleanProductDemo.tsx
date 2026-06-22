import React from "react";
import { BaseDemoComposition } from "./BaseDemoComposition";
import type { RemotionInputProps } from "../../lib/demo-assets/render-plan";

export const CleanProductDemo: React.FC<RemotionInputProps> = (props) => {
  return <BaseDemoComposition {...props} />;
};
