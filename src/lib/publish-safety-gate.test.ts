import { describe, expect, it } from "vitest";
import { getPublishSafetyBlockReasons } from "./publish-safety-gate";

describe("getPublishSafetyBlockReasons", () => {
  it("blocks stale reply-burden content even when stored quality was previously true", () => {
    const reasons = getPublishSafetyBlockReasons({
      content: "이직할지 버틸지 모르겠다면 A/B/C 중 골라봐. 댓글에 지금 상황 짧게 써줘. 같이 보자.",
      firstComment: null,
    });

    expect(reasons).toContain("reply-burden CTA 포함");
  });

  it("blocks soft 같이 봐요 phrasing in the first comment", () => {
    const reasons = getPublishSafetyBlockReasons({
      content: "이직 제안을 받았다면 A. 버팀형 B. 이동형 C. 준비형 중 가까운 쪽만 체크해.",
      firstComment: "프로필에서 타이밍과 결정 패턴을 같이 봐요.",
    });

    expect(reasons).toContain("reply-burden CTA 포함");
  });

  it("blocks generated meta text before publishing", () => {
    const reasons = getPublishSafetyBlockReasons({
      content: "이직 타이밍 체크\nA. 버팀형 B. 이동형 C. 준비형\n\n자수 체크: 500자 이하 통과",
      firstComment: "프로필에서 확인하세요.",
    });

    expect(reasons).toContain("generated meta text 포함");
  });

  it("allows multi-part threads over 500 chars up to 2400 chars", () => {
    const longPost = "이직 고민과 퇴사 타이밍에 대한 상세한 인사이트입니다.\n\n".repeat(20); // ~700 chars
    expect(longPost.length).toBeGreaterThan(500);
    expect(longPost.length).toBeLessThanOrEqual(2400);

    const reasons = getPublishSafetyBlockReasons({
      content: longPost,
      firstComment: "프로필에서 확인하세요.",
    });

    expect(reasons).not.toContain(expect.stringMatching(/업로드 제한 초과/));
    expect(reasons).toHaveLength(0);
  });

  it("blocks extremely long posts exceeding 2400 chars", () => {
    const tooLongPost = "아주 긴 글입니다. ".repeat(250); // ~2500 chars
    expect(tooLongPost.length).toBeGreaterThan(2400);

    const reasons = getPublishSafetyBlockReasons({
      content: tooLongPost,
      firstComment: null,
    });

    expect(reasons.length).toBeGreaterThan(0);
    expect(reasons[0]).toMatch(/5단 스레드 최대 허용.*초과/);
  });

  it("blocks publishing when account trust quota is exceeded", () => {
    const reasons = getPublishSafetyBlockReasons(
      {
        content: "정상적인 텍스트 포스트입니다.",
        firstComment: null,
      },
      {
        accountTrust: {
          tier: "newbie",
          publishedTodayCount: 1, // quota is 1 for newbie
        },
      }
    );

    expect(reasons.some((r) => r.includes("일일 발행 한도 초과"))).toBe(true);
  });

  it("blocks publishing when algorithmic score is below threshold", () => {
    const slopPost = "혁신적인 새로운 지평을 함께 살펴보겠습니다.";
    const reasons = getPublishSafetyBlockReasons(
      {
        content: slopPost,
        firstComment: null,
      },
      {
        minAlgorithmicScore: 80,
      }
    );

    expect(reasons.some((r) => r.includes("알고리즘 탈출 점수 미달"))).toBe(true);
  });

  it("blocks non-WARMUP posts when status is SHADOWBAN_SUSPECTED", () => {
    const reasons = getPublishSafetyBlockReasons(
      {
        content: "이직 타이밍 체크\n\n1. 버팀형 2. 이동형",
        firstComment: null,
        postCategory: "GROWTH",
      },
      {
        accountHealth: {
          status: "SHADOWBAN_SUSPECTED",
        },
      }
    );

    expect(reasons).toContain("스텔스 섀도우밴 위험 상태: WARMUP 카테고리 포스트만 발행 가능");
  });

  it("blocks posts with links during SHADOWBAN_SUSPECTED even if category is WARMUP", () => {
    const reasons = getPublishSafetyBlockReasons(
      {
        content: "따뜻한 공감과 인사이트를 전합니다.",
        firstComment: "자세한 링크: https://cosmicpath.app",
        postCategory: "WARMUP",
      },
      {
        accountHealth: {
          status: "SHADOWBAN_SUSPECTED",
        },
      }
    );

    expect(reasons).toContain("스텔스 섀도우밴 위험 상태: 외부 링크 포함 포스트 발행 금지");
  });

  it("allows clean WARMUP post without links during SHADOWBAN_SUSPECTED", () => {
    const reasons = getPublishSafetyBlockReasons(
      {
        content: "오늘 하루도 고생 많으셨습니다. 스스로에게 휴식을 주는 저녁 되시길 바랍니다.",
        firstComment: null,
        postCategory: "WARMUP",
      },
      {
        accountHealth: {
          status: "SHADOWBAN_SUSPECTED",
        },
      }
    );

    expect(reasons).toHaveLength(0);
  });
});
