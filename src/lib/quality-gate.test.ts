import { describe, expect, it } from "vitest";
import { checkQuality } from "@/lib/quality-gate";

describe("checkQuality", () => {
  it("preserves saju viral pass and fail behavior", () => {
    const passing = checkQuality("혹시 도화살 있는 사람?\nA. 화개살 B. 도화살 C. 역마살 중 가까운 쪽 체크해봐", "saju_viral");
    const failing = checkQuality("좋은 일이 올 거예요. 스스로를 믿으세요.", "saju_viral");

    expect(passing.pass).toBe(true);
    expect(failing.pass).toBe(false);
  });

  it("preserves career decision pass and fail behavior", () => {
    const passing = checkQuality("퇴사해야 할지 버틸지 모르겠다면\nA. 버팀형 B. 이동형 C. 준비형 중 가까운 쪽만 체크해. 저장해두고 다음 선택 전에 다시 봐.", "career_decision");
    const failing = checkQuality("좋은 일이 올 거예요. 스스로를 믿으세요.", "career_decision");

    expect(passing.pass).toBe(true);
    expect(passing.careerDecisionType).toBe("stay");
    expect(failing.pass).toBe(false);
  });

  it("passes non-CosmicPath product content with product growth criteria", () => {
    const result = checkQuality(
      "견적서 보내는 데 아직도 30분씩 쓰고 있어?\nInvoiceFlow가 프리랜서 견적 템플릿을 정리해줘. 랜딩에서 확인해봐.",
      "product_growth",
      {
        productName: "InvoiceFlow",
        productKeywords: ["견적서", "프리랜서", "템플릿"],
        ctaTerms: ["확인", "랜딩"],
      }
    );

    expect(result.pass).toBe(true);
    expect(result.profile).toBe("product_growth");
  });

  it("rejects generic filler for product growth", () => {
    const result = checkQuality(
      "좋은 일이 올 거예요.\n스스로를 믿으면 언젠가 다 잘될 거예요.",
      "product_growth",
      {
        productName: "InvoiceFlow",
        productKeywords: ["견적서", "프리랜서"],
      }
    );

    expect(result.pass).toBe(false);
    expect(result.reasons.join(" ")).toContain("generic");
  });

  it("fails reply-burden CTA for career decision content", () => {
    const result = checkQuality(
      "퇴사해야 할지 버틸지 모르겠다면\n댓글에 사연 남기면 내가 답글로 봐줄게. 버팀형/이동형/준비형으로 진단해줄게.",
      "career_decision"
    );

    expect(result.pass).toBe(false);
    expect(result.reasons.join(" ")).toContain("reply-burden");
  });

  it("fails situation-review CTA for career decision content", () => {
    const result = checkQuality(
      "이직할지 버틸지 모르겠다면\nA. 버팀형 B. 이동형 C. 준비형 중 골라봐. 댓글에 A/B/C 아니면 지금 상황 짧게 써줘. 같이 보자.",
      "career_decision"
    );

    expect(result.pass).toBe(false);
    expect(result.reasons.join(" ")).toContain("reply-burden");
  });

  it("fails overclaiming fortune promises", () => {
    const result = checkQuality(
      "지금 연락하면 상대 마음 100% 알려준다\n댓글에 생일 남기면 미래를 보장해줄게.",
      "saju_viral"
    );

    expect(result.pass).toBe(false);
    expect(result.reasons.join(" ")).toContain("overclaim");
  });

  it("fails low-touch comment self-classification CTA for career decision content", () => {
    const result = checkQuality(
      "이직을 밀어붙일지 멈출지 모르겠다면\nA. 버팀형 B. 이동형 C. 준비형 중 가까운 쪽만 댓글에 남겨. 저장해두고 다음 선택 전에 다시 봐.",
      "career_decision"
    );

    expect(result.pass).toBe(false);
    expect(result.reasons.join(" ")).toContain("reply-burden");
  });

  it("passes self-check classification without comment burden", () => {
    const result = checkQuality(
      "이직을 밀어붙일지 멈출지 모르겠다면\nA. 버팀형 B. 이동형 C. 준비형 중 가까운 쪽만 체크해. 저장해두고 다음 선택 전에 다시 봐.",
      "career_decision"
    );

    expect(result.pass).toBe(true);
    expect(result.reasons).not.toContain("reply-burden");
  });

  it("fails generated meta text in career decision content", () => {
    const result = checkQuality(
      "이직할지 버틸지 모르겠다면\nA. 버팀형 B. 이동형 C. 준비형 중 가까운 쪽만 체크해.\n\n자수 체크: 공백·줄바꿈 포함 약 430자",
      "career_decision"
    );

    expect(result.pass).toBe(false);
    expect(result.reasons.join(" ")).toContain("generated meta text");
  });

  it("passes 5-engine and true solar time terms for saju viral profile", () => {
    const post = "자미두수 12궁과 진태양시 30분 오차를 확인해봐.\n태국 점성술 마하탁사 주기와 수비학으로 보는 골든타임 판정표. 저장해두고 확인해.";
    const result = checkQuality(post, "saju_viral");
    expect(result.pass).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(2);
  });

  it("passes the 3 CosmicPath launch stunt posts", () => {
    const post1 = `솔직히 고백하자면, 지난달까지 우리 앱 결제율 1위였던 타로 기능을 전면 삭제하고 쓰레기통에 넣었다.

주변에서는 다 미쳤냐고 말렸다. 제일 돈 잘 벌리는 기능을 왜 지우냐고.

이유는 단순하다.
타로는 불안한 사람에게 두루뭉술한 바넘 효과로 가짜 위로를 팔기 가장 좋은 도구다.
"좋은 인연이 올 거예요", "곧 마음이 편해집니다"
이런 말로 결제는 쉽게 유도하지만, 정작 중요한 이직·퇴사·계약의 골든타임은 날려버린다.

위로가 필요하면 상담실을 찾아가라.
우리는 사주·점성술·자미두수·태국 점성술·수비학 5대 계산 공식으로 교차 검증된 냉혹한 의사결정 판정만 남기기로 했다.

돈보다 소중한 건 당신의 인생 타이밍이다. 이직 전이라면 저장해두고 꺼내봐.
#이직고민`;

    const post2 = `혹시 알고 있어? 한국인 10명 중 7명은 자기가 태어난 시간(시주)을 잘못 알고 있다.

지금 당장 태어난 시간을 30분 빼고 사주를 다시 봐라.
시주가 바뀌면서 평생 알던 사주의 절반이 뒤집힌다.

한국은 1961년부터 일본 동경 135도 표준시(KST)를 쓰고 있다.
실제 서울 기준 태양 남중 시간과 32분 오차가 난다.
11시 10분에 태어났다고 오시(午時)가 아니라, 진태양시로 보정하면 사시(巳時)다.

시주가 틀리면 이직 타이밍, 말년운, 행동 골든타임 계산이 엉터리가 된다.
30분 오차도 안 잡고 수십만 원 복채 받는 철학관을 아직도 믿는가?

사주는 신비주의가 아니라 천문 역학 데이터다. 저장해두고 내 진짜 시주를 확인해봐.
#진태양시`;

    const post3 = `이직이나 퇴사를 고민할 때 "올해 좋은 기운 온다"고 말하는 곳은 당장 걸러라.

"좋은 기운"이란 말은 아무 책임도 지지 않겠다는 뜻이다.
결정의 기로에 선 사람에게 필요한 건 따뜻한 위로가 아니다.
"이번 달에 움직이면 리스크가 몇 %인지", "지금 버틸지 옮길지"에 대한 명쾌한 판정이다.

CosmicPath는 사주, 점성술, 자미두수, 태국 점성술, 수비학 5개 엔진을 교차 검증한다.
3개 이상 엔진이 불일치하면 가차 없이 "행동 보류" 판정을 내린다.

A. 버팀형 (내부 조건 재정비)
B. 이동형 (골든타임 진입, 즉시 실행)
C. 준비형 (2~4주 리스크 헷징 후 전환)

위로받으려면 타로를 봐라. 결정을 내리려면 CosmicPath를 봐라. 저장해두고 다음 선택 전에 다시 확인해.
#커리어`;

    const r1 = checkQuality(post1, "saju_viral");
    const r2 = checkQuality(post2, "saju_viral");
    const r3 = checkQuality(post3, "career_decision");

    expect(r1.pass).toBe(true);
    expect(r2.pass).toBe(true);
    expect(r3.pass).toBe(true);
  });
});
