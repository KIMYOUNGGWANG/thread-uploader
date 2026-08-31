import { describe, it, expect } from "vitest";
import {
  evaluateRoyLee,
  evaluateTargetUser,
  evaluateManagingEditor,
  evaluateContentWithExpertPanel,
  AI_SLOP_PATTERNS,
} from "./expert-panel-evaluator";

describe("Expert Panel Evaluator", () => {
  const goodViralPost = [
    "솔직히 이직할지 버틸지 고민된다면, 연봉보다 이 3가지 기준부터 나눠봐야 해.",
    "",
    "A. 버팀형: 배울 동료나 시스템이 아직 남아있음",
    "B. 이동형: 3개월 전과 똑같은 문제로 매주 월요일마다 괴로움",
    "C. 준비형: 당장 나갈 포트폴리오 정리가 2주 안에 가능함",
    "",
    "A/B/C 중 어디에 가까워? 저장해두고 다음 선택 전에 다시 봐.",
  ].join("\n");

  const slopPost = [
    "현대 사회에서 커리어 관리는 매우 중요한 역할을 합니다.",
    "뿐만 아니라 작은 습관이 모여 큰 변화를 이룹니다.",
    "결론적으로 포기하지 마세요. 당신은 할 수 있습니다!",
    "댓글로 남겨주시면 무료 자료 DM 드릴게요.",
  ].join("\n");

  it("passes good viral post across all 3 personas", () => {
    const roy = evaluateRoyLee(goodViralPost);
    const user = evaluateTargetUser(goodViralPost, { topic: "이직" });
    const editor = evaluateManagingEditor(goodViralPost);
    const overall = evaluateContentWithExpertPanel(goodViralPost, { topic: "이직" });

    expect(roy.score).toBeGreaterThanOrEqual(75);
    expect(user.score).toBeGreaterThanOrEqual(75);
    expect(editor.pass).toBe(true);
    expect(overall.pass).toBe(true);
    expect(overall.overallScore).toBeGreaterThanOrEqual(80);
  });

  it("catches AI slop patterns and engagement bait in slop post", () => {
    const editor = evaluateManagingEditor(slopPost);
    const overall = evaluateContentWithExpertPanel(slopPost);

    expect(editor.pass).toBe(false);
    expect(editor.flags.length).toBeGreaterThan(0);
    expect(overall.pass).toBe(false);
  });

  it("has exactly 24 AI slop patterns configured", () => {
    expect(AI_SLOP_PATTERNS.length).toBe(24);
  });
});
