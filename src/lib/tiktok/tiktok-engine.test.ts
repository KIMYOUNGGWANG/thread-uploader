// tiktok-engine.test.ts — Unit tests for TikTok short-form script, alignment, and render worker.
import { describe, it, expect } from "vitest";
import { generateTikTokScript } from "./tiktok-script-engine";
import { alignTikTokScenes } from "./tiktok-audio-aligner";
import { buildTikTokRenderSpec, executeTikTokRender } from "./tiktok-render-worker";

describe("TikTok Short-form Engine", () => {
  it("generates a high-retention 4-scene script with 3-second hook", () => {
    const script = generateTikTokScript({
      topic: "사주 재물운",
      dayMaster: "갑목",
      tone: "mysterious",
    });

    expect(script.scenes.length).toBe(4);
    expect(script.scenes[0].type).toBe("kinetic-card");
    expect(script.scenes[0].durationSeconds).toBe(3.5);
    expect(script.scenes[2].type).toBe("saju-card");
    expect(script.qualityScore).toBeGreaterThanOrEqual(80);
    expect(script.qualityPass).toBe(true);
    expect(script.totalDurationSeconds).toBeGreaterThanOrEqual(15);
    expect(script.totalDurationSeconds).toBeLessThanOrEqual(30);
  });

  it("aligns scenes to 30fps frames and formats valid SRT cues", () => {
    const script = generateTikTokScript({ topic: "운세" });
    const alignment = alignTikTokScenes(script.scenes, 30);

    expect(alignment.fps).toBe(30);
    expect(alignment.totalFrames).toBe(Math.round(script.totalDurationSeconds * 30));
    expect(alignment.cues.length).toBe(4);
    expect(alignment.srtContent).toContain("00:00:00,100 -->");
    expect(alignment.sceneTimings[0].fromFrame).toBe(0);
  });

  it("builds a typed RenderSpec adhering to Remotion 9:16 vertical contract", () => {
    const script = generateTikTokScript({ topic: "사주" });
    const spec = buildTikTokRenderSpec(script);

    expect(spec.schemaVersion).toBe("1.0");
    expect(spec.composition).toBe("TikTokExplainer");
    expect(spec.dimensions.width).toBe(1080);
    expect(spec.dimensions.height).toBe(1920);
    expect(spec.fps).toBe(30);
    expect(spec.scenes[0].visual.type).toBe("kinetic-card");
    expect(spec.scenes[2].visual.type).toBe("saju-card");
    expect(spec.captions.style).toBe("tiktok");
  });

  it("executes dry-run rendering successfully without external dependencies", async () => {
    const script = generateTikTokScript({ topic: "사주" });
    const spec = buildTikTokRenderSpec(script);
    const result = await executeTikTokRender(spec, { dryRun: true });

    expect(result.success).toBe(true);
    expect(result.outputPath).toContain("tiktok-explainer.mp4");
  });
});
