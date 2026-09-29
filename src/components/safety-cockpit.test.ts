import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function readProjectFile(path: string): string {
  return readFileSync(path, "utf-8");
}

describe("safety cockpit & 5D post radar components", () => {
  it("verifies ScoreRadarPopover contains SVG radar, 5 axes, and escape velocity indicator", () => {
    const popoverContent = readProjectFile("src/components/ScoreRadarPopover.tsx");

    expect(popoverContent).toContain("AXIS_CONFIG");
    expect(popoverContent).toContain("hookTension");
    expect(popoverContent).toContain("conversationDepth");
    expect(popoverContent).toContain("humanVoice");
    expect(popoverContent).toContain("penaltyRisk");
    expect(popoverContent).toContain("formatReadability");
    expect(popoverContent).toContain("<polygon");
    expect(popoverContent).toContain("escapeVelocityProbability");
    expect(popoverContent).toContain("탈출 확률");
    expect(popoverContent).toContain("개선 권고");
  });

  it("verifies AccountHealthBanner contains status badges, trust tier, and self-healing controls", () => {
    const bannerContent = readProjectFile("src/components/AccountHealthBanner.tsx");

    expect(bannerContent).toContain("SHADOWBAN_SUSPECTED");
    expect(bannerContent).toContain("자율 치유 모드");
    expect(bannerContent).toContain("Trust Tier");
    expect(bannerContent).toContain("WARMUP 포스트 우선 소비");
    expect(bannerContent).toContain("handleEvaluate");
    expect(bannerContent).toContain("handleToggleOverride");
  });

  it("verifies PostCard integrates 5D popover, warmup tag, and 1-click remediation", () => {
    const postCardContent = readProjectFile("src/components/PostCard.tsx");

    expect(postCardContent).toContain("ScoreRadarPopover");
    expect(postCardContent).toContain("postCategory === \"WARMUP\"");
    expect(postCardContent).toContain("handleRemediate");
    expect(postCardContent).toContain("handleForceApprove");
    expect(postCardContent).toContain("5D 자동 교정");
    expect(postCardContent).toContain("강제 승인");
  });

  it("verifies Dashboard mounts AccountHealthBanner and passes algorithmic fields to PostCard", () => {
    const dashboardContent = readProjectFile("src/components/Dashboard.tsx");

    expect(dashboardContent).toContain("<AccountHealthBanner");
    expect(dashboardContent).toContain("algorithmicScore={dbPost.algorithmicScore}");
    expect(dashboardContent).toContain("algorithmicPass={dbPost.algorithmicPass}");
    expect(dashboardContent).toContain("algorithmicDimensions={dbPost.algorithmicDimensions}");
    expect(dashboardContent).toContain("algorithmicFixes={dbPost.algorithmicFixes}");
  });
});
