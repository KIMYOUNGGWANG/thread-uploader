import { describe, it, expect } from "vitest";
import {
  buildTemporalSearchPrompt,
  parseAbstractedTrendResponse,
  harvestTemporalTrends,
  type TargetDomainCategory,
} from "./temporal-trend-harvester";

describe("temporal-trend-harvester", () => {
  it("builds temporal search prompt with date anchor and domain tension requirements", () => {
    const refDate = new Date("2026-10-06T12:00:00Z");
    const prompt = buildTemporalSearchPrompt("CAREER_CONFLICT", refDate);

    expect(prompt).toContain("2026-10-06");
    expect(prompt).toContain("최근 72시간");
    expect(prompt).toContain("CAREER_CONFLICT");
    expect(prompt).toContain("심리적 결핍");
    expect(prompt).toContain("3지선다");
  });

  it("parses JSON response into AbstractedTrendSkeleton array", () => {
    const rawLlmResponse = `Here are the trending skeletons:
\`\`\`json
[
  {
    "unspokenAnxiety": "대기업 네임밸류만 믿고 이직했다가 1년 만에 번아웃 와서 경력 꼬일까 봐 불안함",
    "cognitiveDissonance": "남들은 성공적인 이직이라 축하하는데 본인은 매일 탈출만 생각함",
    "headlineHook": "대기업 간판 보고 이직한 시니어들 1년 만에 조용히 퇴사하는 진짜 이유",
    "choiceOptions": [
      "버팀형: 3년 존버하면 직급 올라온다며 멘탈 갈아넣음",
      "이동형: 또 다른 간판 찾아서 2차 이직 준비 중",
      "준비형: 퇴사 통장 모으면서 부업/독립 각 재는 중"
    ]
  }
]
\`\`\``;

    const skeletons = parseAbstractedTrendResponse(
      rawLlmResponse,
      "CAREER_CONFLICT",
      "직장 이직 번아웃"
    );

    expect(skeletons.length).toBe(1);
    expect(skeletons[0].domain).toBe("CAREER_CONFLICT");
    expect(skeletons[0].headlineHook).toContain("대기업 간판 보고 이직한");
    expect(skeletons[0].choiceOptions.length).toBe(3);
    expect(skeletons[0].unspokenAnxiety).toContain("경력 꼬일까 봐");
  });

  it("falls back gracefully when response contains malformed formatting", () => {
    const malformed = `헤드라인: 코인 억대 수익 후 손절 못해서 전재산 반토막 난 썰
불안: 타이밍은 잡았는데 욕심 때문에 다 털림
선택지: 1. 물타기 2. 손절 3. 존버`;

    const skeletons = parseAbstractedTrendResponse(malformed, "WEALTH_PANIC", "투자 손절");
    expect(skeletons.length).toBeGreaterThanOrEqual(1);
    expect(skeletons[0].domain).toBe("WEALTH_PANIC");
    expect(skeletons[0].headlineHook).toContain("손절");
  });

  it("harvests trends via mock search query function", async () => {
    const mockQueryFn = async (prompt: string) => `[
      {
        "unspokenAnxiety": "연애에서 자존감 갉아먹히는 중",
        "cognitiveDissonance": "사랑해서 참았는데 이용만 당함",
        "headlineHook": "회피형 애인한테 3년 헌신하다가 하루아침에 손절당하는 사람 특징",
        "choiceOptions": ["매달림형", "자책형", "차단형"]
      }
    ]`;

    const results = await harvestTemporalTrends({
      domains: ["RELATIONSHIP_TOXICITY"],
      referenceDate: new Date("2026-10-06T12:00:00Z"),
      queryFn: mockQueryFn,
    });

    expect(results.length).toBe(1);
    expect(results[0].headlineHook).toContain("회피형 애인");
    expect(results[0].domain).toBe("RELATIONSHIP_TOXICITY");
  });
});
