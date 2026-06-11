import { describe, expect, it } from "vitest";
import { buildTikTokRenderPlan } from "@/lib/tiktok-video-renderer";
import type { TikTokVideoDraftResponse } from "@/types/tiktok-video";

const BASE_DRAFT: TikTokVideoDraftResponse = {
  id: "draft-1",
  brandId: "brand-1",
  campaignId: "campaign-1",
  formatId: "career_timing_diagnosis",
  status: "DRAFT",
  title: "퇴사 타이밍 놓칠까봐 불안했던 나",
  spokenHook: "퇴사 타이밍 놓칠까봐 불안했던 나",
  script: "지금 버텨야 하나, 지금 움직여야 하나, 이 불안 반복되는 사람 저만 아니더라고요.",
  sceneBeats: [
    {
      startSecond: 0,
      endSecond: 8,
      visualDirection: "클로즈업 얼굴, 눈 내리깐 채 살짝 지친 표정, 자연광 배경",
      narration: "퇴사 타이밍 놓칠까봐 밥도 제대로 못 먹었던 시절이 있었어요.",
    },
  ],
  captionOverlays: ["타이밍은 달력이 아니라 에너지 흐름에서 보인다"],
  onScreenText: ["지금 이 불안이 어디서 오는지 댓글에 남겨줘요"],
  hashtags: ["#퇴사고민", "#커리어", "#이직타이밍", "#번아웃"],
  cta: "A면 번아웃, B면 타이밍 감이 안 잡힘, C면 그냥 탈출하고 싶음.",
  landingUrl: null,
  utmContent: null,
  qualityProfile: "tiktok_career_timing",
  qualityPass: true,
  qualityScore: 92,
  qualityReasons: [],
  durationSeconds: 25,
  renderTarget: {
    format: "webm",
    width: 1080,
    height: 1920,
    fps: 30,
  },
  createdAt: "2026-06-11T00:00:00.000Z",
  updatedAt: "2026-06-11T00:00:00.000Z",
};

describe("buildTikTokRenderPlan", () => {
  it("keeps visual direction notes out of the visible silent-video plan", () => {
    const plan = buildTikTokRenderPlan(BASE_DRAFT);

    const visibleText = [
      plan.kicker,
      plan.title,
      ...plan.captions,
      ...plan.bodyLines,
      plan.cta,
      ...plan.hashtags,
    ].join(" ");

    expect(visibleText).not.toContain("클로즈업");
    expect(visibleText).not.toContain("자연광 배경");
    expect(visibleText).toContain("타이밍은 달력이 아니라 에너지 흐름에서 보인다");
    expect(visibleText).toContain("A면 번아웃");
  });
});
