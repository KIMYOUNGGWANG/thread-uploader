// tiktok-engine.test.ts — Unit tests for TikTok short-form script, alignment, and render worker.
import { describe, it, expect } from "vitest";
import {
  generateTikTokScript,
  evaluateExplainerQuality,
  buildIgRankScript,
  buildIgPickCardScript,
  IG_REELS_CTA,
} from "./tiktok-script-engine";
import { buildTikTokDraftCreateData, parseFormatId, FORMAT_COMPOSITIONS, TIKTOK_FORMAT_IDS } from "./tiktok-draft-service";
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

  const DAY_MASTERS = ["갑목", "을목", "병화", "정화", "무토", "기토", "경금", "신금", "임수", "계수"];

  it.each(DAY_MASTERS)("%s: 명식 카드의 일주 천간이 요청한 일간과 같다", (dayMaster) => {
    const script = generateTikTokScript({ topic: "사주", dayMaster });
    const pillars = script.scenes[2].visualProps?.sajuData?.pillars ?? [];
    const dayPillar = pillars.find((pillar) => pillar.role === "일주 (본인)");

    expect(dayPillar?.heavenly.name).toBe(dayMaster);
  });

  it.each(DAY_MASTERS)("%s: 훅이 질문을 열고 바로 다음 장면이 그 답을 준다", (dayMaster) => {
    const script = generateTikTokScript({ topic: "사주", dayMaster });

    expect(script.qualityReasons).toEqual([]);
    expect(script.qualityPass).toBe(true);
    expect(script.scenes[0].onScreenText[0]).toContain(dayMaster);
    expect(script.scenes[0].onScreenText[0]).toMatch(/이유|\?/);
  });

  it("일간마다 훅이 다르다 (같은 문구를 10번 돌리지 않는다)", () => {
    const hooks = new Set(DAY_MASTERS.map((dayMaster) => generateTikTokScript({ topic: "사주", dayMaster }).spokenHook));
    expect(hooks.size).toBe(DAY_MASTERS.length);
  });

  it("품질 게이트: 과장·막연한 떡밥 훅은 떨어진다", () => {
    const script = generateTikTokScript({ topic: "사주", dayMaster: "갑목" });
    const baited = {
      ...script,
      scenes: script.scenes.map((scene, index) =>
        index === 0 ? { ...scene, onScreenText: ["갑목 일주, 이번 달 절대 놓치지 마세요"] } : scene
      ),
    };

    const result = evaluateExplainerQuality(baited, "갑목");
    expect(result.qualityPass).toBe(false);
    expect(result.qualityScore).toBeLessThan(100);
    expect(result.qualityReasons.join(" ")).toMatch(/과장|떡밥/);
  });

  it("품질 게이트: 모르는 일간은 답을 줄 수 없으니 떨어진다", () => {
    const script = generateTikTokScript({ topic: "사주", dayMaster: "없는일간" });

    expect(script.qualityPass).toBe(false);
    expect(script.qualityReasons?.length).toBeGreaterThan(0);
  });

  it("품질 사유가 초안에 저장된다", () => {
    const script = generateTikTokScript({ topic: "사주", dayMaster: "없는일간" });
    const data = buildTikTokDraftCreateData("brand-1", script, "DRAFT");

    expect(data.qualityPass).toBe(false);
    expect(JSON.parse(data.qualityReasons)).toEqual(script.qualityReasons);
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

describe("Instagram Reels formats (ig_rank_10s / ig_pickcard_16s)", () => {
  const rankParams = {
    title: "2027년 운 좋은 일간 TOP 5",
    items: ["병화", "임수", "기토", "신금", "을목"],
  };
  const pickParams = {
    question: "A/B/C 중 끌리는 카드 하나, 당신의 11월",
    cards: ["흐름을 바꾸는 선택", "기다리던 인연", "쌓이는 재물"] as [string, string, string],
  };

  it("ig_rank_10s: 10초 단일 rank-card 씬, 자막·오디오 없음, IgRank10s 컴포지션", () => {
    const script = buildIgRankScript(rankParams);
    const spec = buildTikTokRenderSpec(script);

    expect(script.formatId).toBe("ig_rank_10s");
    expect(script.totalDurationSeconds).toBe(10);
    expect(spec.composition).toBe("IgRank10s");
    expect(spec.durationInFrames).toBe(300);
    expect(spec.dimensions).toEqual({ width: 1080, height: 1920 });
    expect(spec.scenes).toHaveLength(1);
    expect(spec.scenes[0].visual.type).toBe("rank-card");
    expect(spec.scenes[0].visual.cardData).toEqual({ title: rankParams.title, items: rankParams.items });
    expect(spec.captions.style).toBe("none");
    expect(spec.audio).toEqual({});
  });

  it("ig_rank_10s: 순위는 정확히 5개", () => {
    expect(() => buildIgRankScript({ ...rankParams, items: ["하나", "둘"] })).toThrow(/5개/);
  });

  it("ig_pickcard_16s: 16초 pick-card 씬, 카드 A/B/C, 12초 지점 선택형 CTA", () => {
    const script = buildIgPickCardScript(pickParams);
    const spec = buildTikTokRenderSpec(script);

    expect(script.formatId).toBe("ig_pickcard_16s");
    expect(spec.composition).toBe("IgPickCard16s");
    expect(spec.durationInFrames).toBe(480);
    expect(spec.scenes[0].visual.type).toBe("pick-card");
    expect(spec.scenes[0].visual.cardData).toMatchObject({
      question: pickParams.question,
      cards: [
        { label: "A", text: "흐름을 바꾸는 선택" },
        { label: "B", text: "기다리던 인연" },
        { label: "C", text: "쌓이는 재물" },
      ],
      cta: IG_REELS_CTA,
      ctaAtSeconds: 12,
    });
    expect(script.cta).toContain("저장");
    expect(script.cta).toMatch(/A\/B\/C/);
  });

  it("릴스 CTA는 키워드 DM·'댓글 달면 해석' 문구를 거부한다", () => {
    expect(() => buildIgPickCardScript({ ...pickParams, cta: "댓글에 식신 남기면 DM 드려요" })).toThrow(/금지된 CTA/);
    expect(() => buildIgRankScript({ ...rankParams, cta: "댓글 달면 해석해드립니다" })).toThrow(/금지된 CTA/);
  });

  it("formatId가 draft와 render spec 사이를 왕복한다 (모르는 값은 기본 포맷)", () => {
    const script = buildIgPickCardScript(pickParams);
    const data = buildTikTokDraftCreateData("brand-1", script, "DRAFT");
    expect(data.formatId).toBe("ig_pickcard_16s");

    const legacy = buildTikTokDraftCreateData("brand-1", generateTikTokScript({ topic: "사주" }), "DRAFT");
    expect(legacy.formatId).toBe("tiktok_explainer_vertical");

    expect(parseFormatId("ig_rank_10s")).toBe("ig_rank_10s");
    expect(parseFormatId("something_else")).toBe("tiktok_explainer_vertical");
    expect(Object.keys(FORMAT_COMPOSITIONS).sort()).toEqual([...TIKTOK_FORMAT_IDS].sort());
  });
});
