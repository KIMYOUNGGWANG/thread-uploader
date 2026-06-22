import type { CreativePlan, SceneBeat, SceneLayer } from "./creative-planner";

// ---------------------------------------------------------------------------
// Quality gate validation for creative plans
// ---------------------------------------------------------------------------

export interface QualityGateResult {
  passed: boolean;
  errors: QualityError[];
  warnings: QualityWarning[];
}

export interface QualityError {
  code: string;
  message: string;
  sceneId?: string;
}

export interface QualityWarning {
  code: string;
  message: string;
  sceneId?: string;
}

// Safe zone constants (9:16 vertical video)
const SAFE_ZONE = {
  topMargin: 150,
  bottomMargin: 350,
  rightMargin: 160,
  maxCharsKorean: 22,
  maxCharsEnglish: 30,
  maxTextLines: 2,
  minScenes: 3,
  maxScenes: 8,
  minTotalDurationSeconds: 5,
  maxTotalDurationSeconds: 30,
  minSceneDurationSeconds: 1,
  maxSceneDurationSeconds: 6,
} as const;

/**
 * Validates a CreativePlan against safe zone rules, text length limits,
 * scene count bounds, and media reference integrity.
 */
export function runQualityGate(plan: CreativePlan): QualityGateResult {
  const errors: QualityError[] = [];
  const warnings: QualityWarning[] = [];

  // 1. Scene count check
  if (plan.scenes.length < SAFE_ZONE.minScenes) {
    errors.push({
      code: "TOO_FEW_SCENES",
      message: `Plan has ${plan.scenes.length} scenes, minimum is ${SAFE_ZONE.minScenes}`,
    });
  }
  if (plan.scenes.length > SAFE_ZONE.maxScenes) {
    errors.push({
      code: "TOO_MANY_SCENES",
      message: `Plan has ${plan.scenes.length} scenes, maximum is ${SAFE_ZONE.maxScenes}`,
    });
  }

  // 2. Total duration check
  const totalDurationSeconds = plan.totalDurationFrames / plan.fps;
  if (totalDurationSeconds < SAFE_ZONE.minTotalDurationSeconds) {
    errors.push({
      code: "TOO_SHORT",
      message: `Total duration ${totalDurationSeconds.toFixed(1)}s is below minimum ${SAFE_ZONE.minTotalDurationSeconds}s`,
    });
  }
  if (totalDurationSeconds > SAFE_ZONE.maxTotalDurationSeconds) {
    warnings.push({
      code: "TOO_LONG",
      message: `Total duration ${totalDurationSeconds.toFixed(1)}s exceeds recommended ${SAFE_ZONE.maxTotalDurationSeconds}s`,
    });
  }

  // 3. Per-scene checks
  for (const scene of plan.scenes) {
    const sceneDurationSeconds = scene.durationFrames / plan.fps;

    if (sceneDurationSeconds < SAFE_ZONE.minSceneDurationSeconds) {
      errors.push({
        code: "SCENE_TOO_SHORT",
        message: `Scene ${scene.sceneId} is ${sceneDurationSeconds.toFixed(1)}s, minimum is ${SAFE_ZONE.minSceneDurationSeconds}s`,
        sceneId: scene.sceneId,
      });
    }
    if (sceneDurationSeconds > SAFE_ZONE.maxSceneDurationSeconds) {
      warnings.push({
        code: "SCENE_TOO_LONG",
        message: `Scene ${scene.sceneId} is ${sceneDurationSeconds.toFixed(1)}s, exceeds recommended ${SAFE_ZONE.maxSceneDurationSeconds}s`,
        sceneId: scene.sceneId,
      });
    }

    // Layer-level checks
    for (const layer of scene.layers) {
      validateLayerSafeZone(layer, scene, plan, errors, warnings);
      validateTextLength(layer, scene, errors);
      validateMediaReference(layer, scene, errors);
    }
  }

  // 4. Must have at least one device/screenshot layer
  const hasDevice = plan.scenes.some((scene) =>
    scene.layers.some((layer) => layer.type === "device"),
  );
  if (!hasDevice) {
    warnings.push({
      code: "NO_DEVICE_LAYER",
      message: "Plan has no device/screenshot layers — video may lack product context",
    });
  }

  // 5. Must have at least one CTA
  const hasCta = plan.scenes.some((scene) =>
    scene.layers.some((layer) => layer.type === "cta"),
  );
  if (!hasCta) {
    warnings.push({
      code: "NO_CTA",
      message: "Plan has no CTA layer — video may lack conversion element",
    });
  }

  return {
    passed: errors.length === 0,
    errors,
    warnings,
  };
}

// ---------------------------------------------------------------------------
// Private validation helpers
// ---------------------------------------------------------------------------

function validateLayerSafeZone(
  layer: SceneLayer,
  scene: SceneBeat,
  plan: CreativePlan,
  errors: QualityError[],
  warnings: QualityWarning[],
): void {
  if (layer.type === "background") return;

  // Text and CTA layers must respect safe zones
  if (layer.type === "text" || layer.type === "cta") {
    if (layer.layout.y < SAFE_ZONE.topMargin) {
      warnings.push({
        code: "TEXT_IN_TOP_SAFE_ZONE",
        message: `Text layer in scene ${scene.sceneId} at y=${layer.layout.y} is within top safe zone (${SAFE_ZONE.topMargin}px)`,
        sceneId: scene.sceneId,
      });
    }

    const bottomEdge = layer.layout.y + layer.layout.height;
    if (bottomEdge > plan.height - SAFE_ZONE.bottomMargin) {
      warnings.push({
        code: "TEXT_IN_BOTTOM_SAFE_ZONE",
        message: `Text layer in scene ${scene.sceneId} extends to y=${bottomEdge}, entering bottom safe zone`,
        sceneId: scene.sceneId,
      });
    }

    const rightEdge = layer.layout.x + layer.layout.width;
    if (rightEdge > plan.width - SAFE_ZONE.rightMargin) {
      warnings.push({
        code: "TEXT_IN_RIGHT_SAFE_ZONE",
        message: `Text layer in scene ${scene.sceneId} extends to x=${rightEdge}, entering right safe zone (${SAFE_ZONE.rightMargin}px)`,
        sceneId: scene.sceneId,
      });
    }
  }
}

function validateTextLength(
  layer: SceneLayer,
  scene: SceneBeat,
  errors: QualityError[],
): void {
  if (layer.type !== "text" && layer.type !== "cta") return;

  const text = layer.source;
  if (!text) return;

  // Detect if primarily Korean
  const koreanCharCount = (text.match(/[\uAC00-\uD7AF]/g) || []).length;
  const isKorean = koreanCharCount > text.length * 0.3;

  const maxChars = isKorean ? SAFE_ZONE.maxCharsKorean : SAFE_ZONE.maxCharsEnglish;
  const lines = text.split("\n");

  if (lines.length > SAFE_ZONE.maxTextLines) {
    errors.push({
      code: "TEXT_TOO_MANY_LINES",
      message: `Text in scene ${scene.sceneId} has ${lines.length} lines, max is ${SAFE_ZONE.maxTextLines}`,
      sceneId: scene.sceneId,
    });
  }

  for (const line of lines) {
    if (line.length > maxChars) {
      errors.push({
        code: "TEXT_LINE_TOO_LONG",
        message: `Text line "${line.slice(0, 20)}..." in scene ${scene.sceneId} is ${line.length} chars, max is ${maxChars}`,
        sceneId: scene.sceneId,
      });
    }
  }
}

function validateMediaReference(
  layer: SceneLayer,
  scene: SceneBeat,
  errors: QualityError[],
): void {
  if (layer.type !== "device") return;

  // Device layers must have a non-empty source (screenshot path)
  if (!layer.source || layer.source.trim() === "") {
    errors.push({
      code: "MISSING_MEDIA_REFERENCE",
      message: `Device layer in scene ${scene.sceneId} has no screenshot path`,
      sceneId: scene.sceneId,
    });
  }
}
