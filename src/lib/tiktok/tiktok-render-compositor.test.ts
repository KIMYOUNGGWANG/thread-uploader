// Guards the render workers against pointing at a compositor that no longer exists
// (they used to read .agent/skills/oma-video, which vanished with the orchestrator).
import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { FORMAT_COMPOSITIONS } from "./tiktok-draft-service";
import { REMOTION_COMPOSITOR_DIR } from "./tiktok-render-worker";
import { REMOTION_COMPOSITOR_DIR as WORKER_SCRIPT_DIR } from "../../../scripts/render-tiktok-worker.mjs";

describe("TikTok render compositor", () => {
  it("API route and CLI worker render from the same compositor", () => {
    expect(WORKER_SCRIPT_DIR).toBe(REMOTION_COMPOSITOR_DIR);
  });

  it("registers every composition the workers request", () => {
    const entry = path.join(REMOTION_COMPOSITOR_DIR, "src/index.ts");
    expect(fs.existsSync(entry)).toBe(true);

    const root = fs.readFileSync(path.join(REMOTION_COMPOSITOR_DIR, "src/Root.tsx"), "utf8");
    for (const composition of Object.values(FORMAT_COMPOSITIONS)) {
      expect(root).toMatch(new RegExp(`id="${composition}"`));
    }
  });
});
