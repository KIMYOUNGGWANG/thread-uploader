import { describe, expect, it } from "vitest";
import { scoreThreadsPostAlgorithmic } from "@/lib/threads-algorithm-scorer";
import { planTwoStageThread } from "@/lib/auto-plug-orchestrator";

describe("Candidate 3 Posts Evaluation", () => {
  const post1 = {
    content: [
      "20대에 연봉 1억 찍은 사람보다 센 게 뭔지 알아?",
      "",
      "돈 많이 버는 것보다 진짜 무서운 건,",
      "언제든 판 엎어지고 바닥 쳐도",
      "3달 만에 현금 흐름 다시 복구해내는 기질이야.",
      "",
      "주변에서 본 가장 생존력 센 사람은 어느 쪽이었어?",
      "1. 무조건 안 쓰고 모아서 2억 만든 사람",
      "2. 다 날려보고도 다시 월 500 세팅한 사람",
      "",
      "솔직히 너넨 1번이랑 2번 중 누가 더 무섭냐?",
    ].join("\n"),
    igniter: "난 무조건 2번. 1번은 판 흔들리면 멘탈 나가는데 2번은 괴물임. 너넨?",
    autoPlug: "내 타고난 기질과 위기 복구력 프로필 링크(↓)에 판정표 걸어둠.",
  };

  const post2 = {
    content: [
      "일 잘하는 사람보다 센 게 뭔지 알아?",
      "",
      "야근하고 보고서 완벽하게 쓰는 것보다 무서운 건,",
      "조직의 꼰대 정치에 뇌를 안 뺏기고",
      "내 기질과 속도에 맞는 승부처를 찾아 탈출하는 사람임.",
      "",
      "솔직히 지금 네 출근길 상태는 어느 쪽에 가까워?",
      "1. 일은 쉬운데 영혼이 썩어가는 기분",
      "2. 실력은 넘치는데 위계 조직에 질식 중",
      "3. 그냥 언제 사표 쓸지 타이밍만 재는 중",
      "",
      "댓글로 번호만 남겨봐.",
    ].join("\n"),
    igniter: "난 퇴사 직전에 딱 1번이었음. 통장에 돈은 꽂히는데 매일 죽어가는 느낌. 너넨?",
    autoPlug: "조직 vs 기질 적합도 5대 엔진 판정 리포트는 프로필 바이오(↓) 확인.",
  };

  const post3 = {
    content: [
      "연봉 1000 올려주는 회사보다 센 게 뭔지 알아?",
      "",
      "숫자 천만 원 올라봤자",
      "세금 떼고 야근에 갈려 나가서 병원비로 다 털림.",
      "",
      "진짜 이직 성공 기준은 딱 하나임.",
      "내 '에너지 충전 주기'랑 회사의 '실행 속도'가 맞느냐.",
      "",
      "솔직히 너네는 이직할 때 둘 중 뭐 절대 포기 못 해?",
      "1. 연봉 20% 상승 (야근 감수)",
      "2. 칼퇴 + 내 프로젝트 할 시간",
      "",
      "댓글로 골라봐.",
    ].join("\n"),
    igniter: "20대엔 1번이었는데 30대 넘어가니까 무조건 2번이더라. 다들 어떰?",
    autoPlug: "이직 타이밍과 결정 패턴 셀프 진단표는 프로필 링크(↓)에 있음.",
  };

  it("evaluates all 3 posts against the 5D Algorithmic Scorer", () => {
    for (const p of [post1, post2, post3]) {
      const score = scoreThreadsPostAlgorithmic(p.content, p.igniter);
      console.log("Post total score:", score.totalScore, "Pass:", score.pass, "P(escape):", score.escapeVelocityProbability);
      expect(score.totalScore).toBeGreaterThanOrEqual(80);
      expect(score.pass).toBe(true);

      const twoStage = planTwoStageThread({
        rootContent: p.content,
        conversationIgniter: p.igniter,
        conversionLink: "https://cosmicpath.app/start",
      });
      expect(twoStage.stage1.content).not.toMatch(/https?:\/\//);
      expect(twoStage.stage1.firstComment).toBe(p.igniter);
      expect(twoStage.stage2.eligibleForAutoPlug).toBe(true);
    }
  });
});
