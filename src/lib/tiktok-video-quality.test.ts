import { describe, expect, it } from "vitest";
import { checkTikTokVideoQuality } from "./tiktok-video-quality";

const baseInput = {
  formatId: "self_classification" as const,
  spokenHook: "이직할지 버틸지 헷갈리면 이 3가지만 봐",
  captionOverlays: ["이직 고민 A/B/C"],
  onScreenText: ["커리어 타이밍", "버팀형 / 이동형 / 준비형"],
  sceneBeats: [
    {
      startSecond: 0,
      endSecond: 2,
      visualDirection: "A/B/C 선택지 자막",
      narration: "지금 흐름을 A/B/C로만 골라봐",
    },
  ],
};

describe("checkTikTokVideoQuality", () => {
  it("passes low-touch self-classification CTAs", () => {
    const result = checkTikTokVideoQuality({
      ...baseInput,
      script: "이직 고민이 반복된다면 결정 패턴부터 봐야 해. A는 버팀형, B는 이동형, C는 준비형이야. A/B/C 중 가까운 선택지만 골라봐.",
      cta: "A/B/C 중 가까운 선택지만 골라봐.",
    });

    expect(result.pass).toBe(true);
  });

  it("fails situation-review CTAs that imply operator follow-up", () => {
    const result = checkTikTokVideoQuality({
      ...baseInput,
      script: "이직 고민이 반복된다면 결정 패턴부터 봐야 해. A는 버팀형, B는 이동형, C는 준비형이야. 댓글에 A/B/C랑 지금 상황을 짧게 써줘.",
      cta: "댓글에 A/B/C와 지금 상황을 짧게 남겨줘.",
      sceneBeats: [
        ...baseInput.sceneBeats,
        {
          startSecond: 13,
          endSecond: 25,
          visualDirection: "댓글 입력 예시",
          narration: "댓글에 상황을 남기면 어느 흐름에 가까운지 같이 볼 수 있어.",
        },
      ],
    });

    expect(result.pass).toBe(false);
    expect(result.reasons).toContain("운영자 답변이 필요한 상황 검토 CTA가 있습니다");
  });
});
