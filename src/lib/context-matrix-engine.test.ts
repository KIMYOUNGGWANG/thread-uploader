import { describe, expect, it } from "vitest";
import {
  DOMAIN_MATRICES,
  resolveDynamicContext,
} from "./context-matrix-engine";

describe("context-matrix-engine", () => {
  it("has complete 8x8x8 dimensions for each defined domain", () => {
    const domains = ["saju_viral", "career_decision", "product_growth", "ecommerce_d2c"] as const;
    for (const domain of domains) {
      const matrix = DOMAIN_MATRICES[domain];
      expect(matrix).toBeDefined();
      expect(matrix.personas.length).toBe(8);
      expect(matrix.frictions.length).toBe(8);
      expect(matrix.tensions.length).toBe(8);
    }
  });

  it("guarantees 0% tuple duplication over all 512 consecutive generations using affine state-space permutation", () => {
    const seenTuples = new Set<string>();
    const totalGenerations = 512;

    for (let i = 0; i < totalGenerations; i++) {
      const context = resolveDynamicContext({
        domainId: "saju_viral",
        index: i,
      });

      const tupleKey = `${context.persona}__${context.friction}__${context.tension}`;
      expect(seenTuples.has(tupleKey)).toBe(false);
      seenTuples.add(tupleKey);
    }

    expect(seenTuples.size).toBe(totalGenerations);
  });

  it("correctly falls back to relevant domain when partial keywords match", () => {
    const productContext = resolveDynamicContext({
      domainId: "custom_product_tool",
      index: 0,
    });
    expect(DOMAIN_MATRICES.product_growth.personas).toContain(productContext.persona);

    const careerContext = resolveDynamicContext({
      domainId: "my_career_app",
      index: 1,
    });
    expect(DOMAIN_MATRICES.career_decision.personas).toContain(careerContext.persona);

    const fallbackContext = resolveDynamicContext({
      domainId: "unknown_weird_domain",
      index: 2,
    });
    expect(DOMAIN_MATRICES.saju_viral.personas).toContain(fallbackContext.persona);
  });

  it("enriches baseTopic and custom user targets while preserving intent", () => {
    const context = resolveDynamicContext({
      domainId: "career_decision",
      index: 0,
      baseTopic: "이직 타이밍 분석",
      userTarget: "30대 테크 개발자",
      userSituation: "연봉 협상 직전",
    });

    expect(context.dynamicTopic).toContain("이직 타이밍 분석");
    expect(context.dynamicTopic).toContain(context.persona);
    expect(context.dynamicTopic).toContain(context.friction);

    expect(context.targetAudience).toContain("30대 테크 개발자");
    expect(context.targetAudience).toContain(context.persona);

    expect(context.situation).toContain("연봉 협상 직전");
    expect(context.situation).toContain(context.friction);
  });

  it("generates realistic default targets and situations when user targets are generic", () => {
    const context = resolveDynamicContext({
      domainId: "saju_viral",
      index: 5,
      userTarget: "일반 독자",
      userSituation: "일상적인 상황",
    });

    expect(context.targetAudience).not.toBe("일반 독자");
    expect(context.targetAudience).toContain(context.persona);
    expect(context.targetAudience).toContain(context.friction);

    expect(context.situation).toContain(context.friction);
    expect(context.situation).toContain(context.tension);
  });

  it("exploits high-performing personas when contextWeights are provided", () => {
    const promotedPersona = "3년차 UI/UX 디자이너";
    const promotedFriction = "성과 가로채기와 사내 정치 싸움에 휘말린 상태";

    const personaWeights = {
      [promotedPersona]: 10,
    };
    const frictionWeights = {
      [promotedFriction]: 10,
    };

    let promotedPersonaCount = 0;
    let promotedFrictionCount = 0;
    const totalSamples = 40;

    for (let i = 0; i < totalSamples; i++) {
      const context = resolveDynamicContext({
        domainId: "saju_viral",
        index: i,
        contextWeights: {
          personaWeights,
          frictionWeights,
          epsilon: 0.2,
        },
      });

      if (context.persona === promotedPersona) promotedPersonaCount++;
      if (context.friction === promotedFriction) promotedFrictionCount++;
    }

    // Without weights, uniform probability across 8 personas is 12.5% (~5 out of 40).
    // With weight 10 vs 3s (10 / (10 + 7*3) = ~32%), and 80% exploitation:
    // promoted count should be substantially higher than uniform (>= 8).
    expect(promotedPersonaCount).toBeGreaterThan(8);
    expect(promotedFrictionCount).toBeGreaterThan(8);
  });
});
