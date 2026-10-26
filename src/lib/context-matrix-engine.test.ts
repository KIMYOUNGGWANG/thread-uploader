import { describe, expect, it } from "vitest";
import {
  DOMAIN_MATRICES,
  resolveDynamicContext, isRelationshipTopic, planTopicQuota } from "./context-matrix-engine";
import { findJargonTerms } from "./readability-rules";

describe("context-matrix-engine", () => {
  it("has complete 8x8x8 dimensions for each defined domain", () => {
    const domains = ["saju_viral", "saju_relationship", "career_decision", "product_growth", "ecommerce_d2c"] as const;
    for (const domain of domains) {
      const matrix = DOMAIN_MATRICES[domain];
      expect(matrix).toBeDefined();
      expect(matrix.personas.length).toBe(8);
      expect(matrix.frictions.length).toBe(8);
      expect(matrix.tensions.length).toBe(8);
    }
  });

  // paired domains (saju_*) only have persona x tension = 64 distinct tuples, so the 512 check uses an unpaired domain.
  it("guarantees 0% tuple duplication over all 512 consecutive generations using affine state-space permutation", () => {
    const seenTuples = new Set<string>();
    const totalGenerations = 512;

    for (let i = 0; i < totalGenerations; i++) {
      const context = resolveDynamicContext({
        domainId: "career_decision",
        index: i,
      });

      const tupleKey = `${context.persona}__${context.friction}__${context.tension}`;
      expect(seenTuples.has(tupleKey)).toBe(false);
      seenTuples.add(tupleKey);
    }

    expect(seenTuples.size).toBe(totalGenerations);
  });

  it("serves the relationship axis when asked and shifts contexts with the index offset", () => {
    const first = resolveDynamicContext({ domainId: "saju_relationship", index: 0 });
    expect(DOMAIN_MATRICES.saju_relationship.personas).toContain(first.persona);

    const nextRun = resolveDynamicContext({ domainId: "saju_relationship", index: 15 });
    expect(`${nextRun.persona}${nextRun.friction}${nextRun.tension}`)
      .not.toBe(`${first.persona}${first.friction}${first.tension}`);
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
    const promotedPersona = "점집에서 10만원 내고 나온 20대";
    const promotedFriction = "복채는 냈는데 '좋은 흐름 온다'는 말밖에 못 들은 상황";

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

describe("paired persona and friction", () => {
  it.each(["saju_relationship", "saju_viral"])("always pairs persona i with friction i in %s", (domainId) => {
    for (let index = 0; index < 200; index++) {
      const ctx = resolveDynamicContext({ domainId, index });
      const matrix = DOMAIN_MATRICES[domainId];
      expect(matrix.personas.indexOf(ctx.persona)).toBe(matrix.frictions.indexOf(ctx.friction));
    }
  });

  it("keeps pairing when contextWeights pick the persona", () => {
    const ctx = resolveDynamicContext({
      domainId: "saju_relationship",
      index: 2,
      contextWeights: { personaWeights: { "친한 친구에게 동업을 제안받은 직장인": 100 }, epsilon: 0.01 },
    });
    expect(ctx.persona).toBe("친한 친구에게 동업을 제안받은 직장인");
    expect(ctx.friction).toBe("친한 사이라 거절하기 어려운 동업 제안");
  });

  it("ignores frictionWeights on a paired matrix", () => {
    const ctx = resolveDynamicContext({
      domainId: "saju_relationship",
      index: 2,
      contextWeights: {
        personaWeights: { "친한 친구에게 동업을 제안받은 직장인": 100 },
        frictionWeights: { "읽씹과 칼답이 번갈아 오는 연락 패턴": 1000 },
        epsilon: 0.01,
      },
    });
    expect(ctx.friction).toBe("친한 사이라 거절하기 어려운 동업 제안");
  });

  it.each(["saju_viral", "saju_relationship"])("has at most one jargon term per seed line in %s", (domainId) => {
    const { personas, frictions, tensions } = DOMAIN_MATRICES[domainId];
    for (const line of [...personas, ...frictions, ...tensions]) expect(findJargonTerms(line).length).toBeLessThanOrEqual(1);
  });

  it("leaves other matrices unpaired", () => {
    expect(DOMAIN_MATRICES.career_decision.pairedFrictions).toBeUndefined();
  });
});

describe("topic quota", () => {
  const relationship = ["썸 상대에게 지금 고백할지 기다릴지 판정", "재회 후 다시 흔들릴 때 밀어붙일지 접을지 기준", "동업 제안을 받았을 때 둘의 기질 궁합 체크"];
  const career = ["이직/퇴사 타이밍 (지금 존버할 때 vs 판 엎을 때)", "재물/돈 창고와 새는 구멍", "현실 진로/재능 판정 (공부 머리 vs 일 머리)"];

  it("classifies relationship topics by axis keywords", () => {
    expect(relationship.every(isRelationshipTopic)).toBe(true);
    expect(career.some(isRelationshipTopic)).toBe(false);
  });

  // Regression: 2026-10 every cosmicpath topic was a relationship one, so 26 of 30 posts shared two scenarios.
  it("keeps a batch half relationship, half other, alternating from the first slot", () => {
    const plan = planTopicQuota([...relationship, ...career], 6, 0.5, () => 0.5);
    expect(plan.filter(isRelationshipTopic)).toHaveLength(3);
    expect(plan.map(isRelationshipTopic)).toEqual([true, false, true, false, true, false]);
    expect(new Set(plan).size).toBe(6);
  });

  it("gives a 2-post chunk one topic of each axis and cycles when a batch outgrows the list", () => {
    expect(planTopicQuota([...relationship, ...career], 2, 0.5, () => 0.5).map(isRelationshipTopic)).toEqual([true, false]);
    expect(planTopicQuota([relationship[0], career[0]], 5, 0.5, () => 0.5)).toHaveLength(5);
  });

  it("falls back to a plain cycle when only one axis is configured", () => {
    expect(planTopicQuota(relationship, 4, 0.5, () => 0.5)).toHaveLength(4);
  });
});
