import { describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  createdPosts: [] as Array<{ id: string; campaignFormulaId: string | null }>,
}));

const DIVERSE_POST_BODIES = [
  "연봉 동결 통보받았을 때 이직할지 잔류할지 판정 기준 1.\n\n1. 회사 재무제표 적자인가\n2. 사수 역량 뛰어난가\n3. 내년 이직 시장 수요 있는가\n\n기준 세우고 움직여라.",
  "퇴사 고민할 때 번아웃인지 조직 결함인지 구분하는 지침 2.\n\n- 주말에도 가슴 답답하면 조직 문제\n- 휴가 다녀와도 무기력하면 번아웃\n- 비상 통장 6개월치 없으면 버텨라.",
  "상사와 마찰로 퇴사 충동 느낄 때 체크할 세 가지 항목 3.\n\n첫째, 타 부서 이동 가능한가\n둘째, 평판 조회 시 불리한가\n셋째, 실업급여 수급 조건 되는가\n\n감정보다 실리가 우선이다.",
  "물경력 걱정될 때 내 직무 전문성 검증 체크리스트 4.\n\n- 이력서 기술 스택 최신인가\n- 외부 강의나 세미나 발표 경험\n- 성과를 숫자로 측정 가능한가\n\n답변 못하면 아직 이직 타이밍 아니다.",
  "헤드헌터 연락 왔을 때 무작정 수락하면 안 되는 이유 5.\n\n1. 현 직장 대비 처우 상승분 15% 미만\n2. 팀 빌딩 초기 단계 불안 요소\n3. 전임자 퇴사 사유 불명확\n\n돌다리 두드리고 건너라.",
  "스타트업 이직 제안받았을 때 스톡옵션 함정 피하기 6.\n\n- 액면가와 행사가격 차이 확인\n- 베스팅 기간 최소 2년 조건\n- 투자 유치 단계 및 런웨이 파악\n\n종이쪽지 보고 인생 걸지 마라.",
  "동기들 승진 소식에 혼자 뒤처지는 느낌 들 때 멘탈 관리 7.\n\n남의 속도에 내 보폭을 맞추지 마라.\n지금 집중할 건 내 핵심 기술 연마다 업그레이드하는 것뿐이다.",
  "팀장이 성과 가로챌 때 조용히 대처하는 실무 가이드 8.\n\n메일 참조에 상위 임원 포함시키기.\n회의록 작성 후 전원 공유하여 기록 박제.\n포트폴리오용 증빙 캡처 보관.",
  "직무 변경 고민할 때 리스크 최소화하는 로드맵 9.\n\n현재 회사에서 사이드 프로젝트로 경험 쌓기.\n유관 부서 협업 기회 적극 발굴.\n외부 부트캠프나 자격증으로 보완.",
  "잡무만 쏟아질 때 커리어 방어하는 업무 정리 기술 10.\n\n일일 업무 루틴 시간대별 분류.\n자동화 도구 도입으로 단순 노동 50% 단축.\n남는 시간에 핵심 과제 집중.",
  "원격근무 vs 풀출근 이직 조건 갈등될 때 판단 기준 11.\n\n통근 편도 1시간 이상이면 체력 소모 심각.\n원격 지원 장비 및 통신비 지원 확인.\n협업 툴과 문서화 문화 정착 여부 점검.",
  "포트폴리오 업데이트 안 된 지 1년 넘었을 때 지금 할 일 12.\n\n지난 분기 완료 프로젝트 성과 수치화.\n실패 경험과 개선 과정 회고 작성.\n노션 대신 깃허브나 PDF로 정돈.",
  "회사 경영 악화 소문 돌 때 구조조정 대비 플랜 13.\n\n경력기술서 즉시 최신화.\n동종업계 인맥과 커피챗 일정 잡기.\n신용대출 및 고정 지출 긴축 점검.",
  "연봉 협상에서 원하는 금액 관철시키는 대화법 14.\n\n동종 업계 중간값 데이터 지참.\n내가 기여한 매출 및 비용 절감 증명.\n대체 불가능한 업무 영역 강조.",
  "사수 없이 신입 혼자 일할 때 성장 정체 뚫는 방법 15.\n\n외부 멘토링 프로그램 참여.\n오픈소스 코드 분석 및 클론 코딩.\n사내 문제 해결을 주도적으로 제안.",
  "주니어 티 벗고 시니어 인정받기 위해 필요한 전환점 16.\n\n내 일만 잘하는 것에서 팀 생산성 향상으로.\n기술적 의사결정의 근거와 트레이드오프 기록.\n후배 피드백과 온보딩 가이드 제작.",
  "야근 밥먹듯 하는데 성과급 없을 때 이탈 시점 판정 17.\n\n건강검진 수치 악화 여부.\n대표나 임원의 약속 불이행 횟수.\n야근이 사업 성장으로 이어지는지 확인.",
  "사내 정치 피곤해서 조용히 살고 싶을 때 생존 전략 18.\n\n사적 모임보다 공적 업무 완결에 집중.\n모든 지시는 텍스트나 메일로 확답 수령.\n선 넘는 부탁은 규정 들어 정중히 거절.",
  "잡플래닛 평점 2점대 회사 오퍼 받았을 때 거절해야 할까 19.\n\n경영진 평판과 퇴사율 추이 확인.\n면접관 태도에서 조직 문화 간접 체감.\n단기 징검다리 목적이라면 1년 버티기 각오.",
  "이력서 서류 탈락 연속 10번 넘었을 때 서류 긴급 수술 20.\n\n자기소개서 첫 단락을 성과 요약으로 전면 개편.\n직무 기술서 키워드와 매칭률 80% 달성.\n불필요한 자격증과 장황한 나열 삭제.",
  "비전공자 개발자 이직 시장에서 차별화하는 전략 21.\n\n도메인 지식과 이전 직무 경험 결합.\n단순 투두리스트 아닌 트래픽 처리 경험 증명.\n모니터링과 테스트 코드 작성 습관 어필.",
  "회사 복지는 좋은데 일이 재미없을 때 탈출할까 22.\n\n안정적인 급여 받으며 퇴근 후 사이드 프로젝트 몰입.\n사내 신규 TF나 전환 배치 기회 탐색.\n독립 가능한 현금 흐름 생길 때까지 버티기.",
  "경력 공백기 6개월 넘어가서 면접관이 물어볼 때 답변 팁 23.\n\n단순 휴식이 아닌 재충전과 스킬셋 재정비로 프레이밍.\n공백기 동안 수강한 강의 및 프로젝트 산출물 제시.\n즉시 전력 투입 가능한 컨디션 강조.",
  "소기업 팀장 vs 대기업 팀원 이직 갈림길 선택법 24.\n\n의사결정 권한과 폭넓은 경험 원하면 소기업 팀장.\n체계적인 프로세스와 브랜드 가치 원하면 대기업 팀원.\n내 5년 뒤 목표 직함에 맞는 쪽 선택.",
  "성과급 갈등으로 동료와 서먹해졌을 때 대처법 25.\n\n평가 시스템의 구조적 문제임을 인지.\n개인적 감정 드러내지 않고 프로페셔널 태도 유지.\n내 실적 기록은 철저히 개인 클라우드 백업.",
  "이직한 회사 첫 달에 적응 실패했다고 느껴질 때 26.\n\n3개월 온보딩 기간까지는 성급한 판단 보류.\n팀 내 키맨 파악하여 1대1 질문 요청.\n회사 특유의 용어집과 히스토리 문서 정독.",
  "프리랜서 전향 고민할 때 통장 잔고 외에 확인할 것 27.\n\n고정 클라이언트 최소 2곳 확보 여부.\n세무 및 건강보험료 자가 정산 지식.\n스스로 마감 지킬 수 있는 루틴 형성.",
  "은퇴 후 커리어 2막 준비하는 직장인의 현실 플랜 28.\n\n현직에 있을 때 개인 브랜딩 채널 개설.\n전문 분야 전자책 출간이나 강의 레퍼런스 축적.\n지속 가능한 네트워크 구축.",
];

let mockPostCallCounter = 0;
vi.mock("@anthropic-ai/sdk", () => ({
  default: class MockAnthropic {
    messages = {
      create: vi.fn(async () => {
        const body = DIVERSE_POST_BODIES[mockPostCallCounter % DIVERSE_POST_BODIES.length];
        const count = mockPostCallCounter++;
        return {
          content: [{
            type: "text",
            text: `${body}\n\n===FIRST_COMMENT===\n북마크 ${count} 저장`,
          }],
        };
      }),
    };
  },
}));

vi.mock("@/lib/brand-access", () => ({
  accessErrorResponse: () => null,
  requireBrandForCurrentUser: vi.fn(async () => ({
    brand: {
      id: "brand_1",
      brandConfig: JSON.stringify({
        systemPrompt: "Write concise CosmicPath posts.",
        topics: ["이직 타이밍"],
        targets: ["이직을 고민하는 사람"],
        situations: ["퇴사와 이직 사이에서 흔들리는 상황"],
        websiteUrl: "cosmicpath.app",
        campaigns: [{
          id: "career_timing_wedge_399",
          name: "커리어 타이밍 불안 wedge",
          mode: "landing-test",
          qualityProfile: "career_decision",
          landingUrl: "/career/uncertainty",
          utmSource: "threads",
          utmCampaign: "career_timing_wedge_399",
          utmContentTemplate: "{{postId}}",
          dailyPostTarget: 3,
          linkCadenceEvery: 1000,
          linkPlacement: "firstComment",
          formulas: [
            {
              id: "self_classification",
              name: "자기분류 셀프체크형",
              weight: 3,
              instruction: "A/B/C 중 하나를 본문 안에서 체크하게 만든다.",
            },
            {
              id: "saveable_tool",
              name: "저장형 판단 도구",
              weight: 2,
              instruction: "저장 가능한 체크리스트로 만든다.",
            },
            {
              id: "friend_share",
              name: "친구 공유형",
              weight: 2,
              instruction: "친구에게 보내주고 싶게 만든다.",
            },
          ],
          replyPlaybook: {
            stay: "버팀형",
            move: "이동형",
            prepare: "준비형",
            cta: "프로필 링크 확인",
          },
        }],
        activeCampaignId: "career_timing_wedge_399",
        qualityProfile: "career_decision",
      }),
      formulaWeights: "{}",
      growthMemory: "{}",
      viralMemory: "{}",
    },
  })),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    post: {
      findMany: vi.fn(async () => []),
      findFirst: vi.fn(async () => null),
      create: vi.fn(async ({ data }) => {
        const post = {
          id: `post_${state.createdPosts.length}`,
          ...data,
        };
        state.createdPosts.push(post);
        return post;
      }),
      update: vi.fn(async ({ where, data }) => {
        const post = state.createdPosts.find((item) => item.id === where.id);
        return Object.assign(post ?? { id: where.id }, data);
      }),
    },
  },
}));

vi.mock("@/lib/quality-gate", () => ({
  checkQuality: vi.fn(() => ({
    pass: true,
    score: 5,
    profile: "career_decision",
    reasons: [],
    careerDecisionType: "stay",
  })),
}));

describe("POST /api/generate viral sprint matrix", () => {
  it("persists 28 generated campaign posts into four 7-post viral mode buckets", async () => {
    state.createdPosts.length = 0;
    const { POST } = await import("@/app/api/generate/route");

    const response = await POST(new Request("http://localhost/api/generate", {
      method: "POST",
      body: JSON.stringify({
        brandId: "brand_1",
        count: 28,
        campaignId: "career_timing_wedge_399",
      }),
    }) as never);
    const body = await response.json();

    const counts = state.createdPosts.reduce<Record<string, number>>((result, post) => {
      const modeId = post.campaignFormulaId ?? "missing";
      result[modeId] = (result[modeId] ?? 0) + 1;
      return result;
    }, {});

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ success: true, count: 28, campaignId: "career_timing_wedge_399" });
    expect(counts).toEqual({
      self_classification: 7,
      saveable_tool: 7,
      quiet_contrarian: 7,
      friend_share: 7,
    });
  }, 10000);
});
