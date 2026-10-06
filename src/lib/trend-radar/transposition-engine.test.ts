import { describe, it, expect } from "vitest";
import {
  buildTranspositionPrompt,
  parseTransposedResponse,
  transposeSkeleton,
  mapCandidateToViralPatternData,
  type TransposedViralCandidate,
} from "./transposition-engine";
import { resolveBrandProfile } from "../brand-profile";
import type { AbstractedTrendSkeleton } from "./temporal-trend-harvester";

describe("transposition-engine", () => {
  const sampleSkeleton: AbstractedTrendSkeleton = {
    id: "sk-123",
    domain: "CAREER_CONFLICT",
    sourceQuery: "대기업 이직 번아웃",
    unspokenAnxiety: "네임밸류 믿고 갔다가 1년 만에 커리어 꼬일까 봐 불안함",
    cognitiveDissonance: "간판만 보고 갔는데 시스템이 없어서 멘탈 터짐",
    headlineHook: "대기업 간판 보고 이직한 시니어들 1년 만에 조용히 퇴사하는 진짜 이유",
    choiceOptions: [
      "A. 버팀형: 3년 존버하면 직급 올라온다며 멘탈 갈아넣음",
      "B. 이동형: 또 다른 간판 찾아서 2차 이직 준비 중",
      "C. 준비형: 퇴사 통장 모으면서 부업/독립 각 재는 중",
    ],
    harvestedAt: "2026-10-06T12:00:00Z",
  };

  it("builds transposition prompt with brand persona, natal concepts, and tone requirements", () => {
    const profile = resolveBrandProfile("{}", "cosmicpath", "CosmicPath");
    const prompt = buildTranspositionPrompt(sampleSkeleton, profile);

    expect(prompt).toContain(profile.persona);
    expect(prompt).toContain(sampleSkeleton.headlineHook);
    expect(prompt).toContain("도메인 치환");
    expect(prompt).toContain("진술축미");
  });

  it("parses valid JSON response into TransposedViralCandidate", () => {
    const rawLlmResponse = `\`\`\`json
{
  "hookHeadline": "솔직히 대기업 네임밸류 믿고 이직했다가 1년 만에 번아웃 오는 사람들 사주 까보면 90%가 비견·겁재 대운임",
  "openingNarrative": "그 사람 실력이 모자란 게 아님. 사주 데이터 까보면 딱 비견·겁재 날뛰는 타이밍에 남들 시선 의식해서 간판만 보고 결정한 거더라.",
  "brandEquivalentConcept": "비견·겁재 과열기 및 대운 전환기 불일치",
  "choiceMatrix": [
    "A. 버팀형: 간판 믿고 3년 존버 (멘탈 고갈)",
    "B. 이동형: 홧김에 환승 이직 (패턴 반복)",
    "C. 준비형: 내 통제 시스템 구축 (교운기 돌파)"
  ]
}
\`\`\``;

    const profile = resolveBrandProfile("{}", "cosmicpath", "CosmicPath");
    const candidate = parseTransposedResponse(rawLlmResponse, sampleSkeleton, profile);

    expect(candidate.hookHeadline).toContain("비견·겁재");
    expect(candidate.openingNarrative).toContain("사주 데이터 까보면");
    expect(candidate.domainMapping.brandEquivalentConcept).toContain("비견·겁재");
    expect(candidate.choiceMatrix.length).toBe(3);
  });

  it("transposes skeleton to candidate via mock LLM runner", async () => {
    const profile = resolveBrandProfile("{}", "cosmicpath", "CosmicPath");
    const mockQueryFn = async () => JSON.stringify({
      hookHeadline: "대운 교운기에는 간판보다 내 손의 통제력이 우선임",
      openingNarrative: "조직 에너지가 꺾일 때 들어간 네임밸류는 독이 됨",
      brandEquivalentConcept: "대운 교운기 타이밍",
      choiceMatrix: ["A. 버팀형", "B. 이동형", "C. 준비형"],
    });

    const result = await transposeSkeleton(sampleSkeleton, profile, mockQueryFn);
    expect(result.hookHeadline).toContain("대운 교운기");
    expect(result.targetDomain).toBe("CAREER_CONFLICT");
  });

  it("maps candidate to Prisma ViralPattern database payload", () => {
    const candidate: TransposedViralCandidate = {
      skeletonId: "sk-123",
      targetDomain: "CAREER_CONFLICT",
      hookHeadline: "테스트 치환 훅",
      openingNarrative: "테스트 본문 서두",
      domainMapping: {
        originalConflict: "이직 번아웃",
        brandEquivalentConcept: "비견 대운",
      },
      choiceMatrix: ["A", "B", "C"],
    };

    const patternPayload = mapCandidateToViralPatternData(candidate, "brand-456");
    expect(patternPayload.brandId).toBe("brand-456");
    expect(patternPayload.dimension).toBe("transposed_hook");
    expect(patternPayload.value).toBe(candidate.hookHeadline);
    expect(patternPayload.avgViralScore).toBe(90);
    expect(patternPayload.recommendation).toContain("비견 대운");
  });
});
