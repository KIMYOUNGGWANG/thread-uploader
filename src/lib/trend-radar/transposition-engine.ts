import type { AbstractedTrendSkeleton } from "./temporal-trend-harvester";
import type { BrandProfile } from "../brand-profile";

export interface TransposedViralCandidate {
  skeletonId: string;
  targetDomain: string;
  hookHeadline: string;
  openingNarrative: string;
  domainMapping: {
    originalConflict: string;
    brandEquivalentConcept: string;
  };
  choiceMatrix: [string, string, string];
  viralPatternId?: string;
}

export function buildTranspositionPrompt(
  skeleton: AbstractedTrendSkeleton,
  profile: BrandProfile
): string {
  const brandKeywords = profile.fidelity.identityMarkers.slice(0, 8).join(", ");

  return `
[역할 및 페르소나]
당신은 최고의 바이럴 콘텐츠 아키텍트입니다.
브랜드 페르소나: ${profile.persona}
어조(Tone): ${profile.tone}
핵심 개념 키워드: ${brandKeywords}
언어: ${profile.language === "en" ? "English" : "Korean"}

[원시 심리 골격 (이종 도메인에서 검증된 바이럴 뼈대)]
- 카테고리: ${skeleton.domain}
- 원본 훅 헤드라인: "${skeleton.headlineHook}"
- 독자의 은밀한 불안: "${skeleton.unspokenAnxiety}"
- 인지 부조화 상황: "${skeleton.cognitiveDissonance}"
- 기존 3지선다 분류:
  1) ${skeleton.choiceOptions[0]}
  2) ${skeleton.choiceOptions[1]}
  3) ${skeleton.choiceOptions[2]}

[도메인 치환 임무 (Structural Transposition)]
원문의 텍스트나 고유명사는 100% 버리고, 위 '심리적 골격(신념 배신 + 3지선다 처지 분류)'만을 훔쳐서 우리 브랜드 페르소나의 언어로 완전히 재작성하라.

규칙:
1. 원본 갈등을 우리 브랜드 개념(예: 사주 대운, 교운기, 비견·겁재, 일주, 오행 결핍 등)으로 1:1 대칭 매핑하라.
2. 훅 헤드라인은 스크롤을 즉시 멈추게 하는 도발적이고 날카로운 반말투(또는 브랜드 톤)로 작성하라.
3. 3지선다는 독자가 즉시 "A/B/C 중 난 어디지?"라고 몰입하게 만들어라.

[출력 JSON 규격 (반드시 \`\`\`json \`\`\` 블록으로 반환)]
\`\`\`json
{
  "hookHeadline": "새롭게 치환된 메인 훅 헤드라인 (30~45자)",
  "openingNarrative": "훅 바로 뒤에 이어질 현실 자각 서두 (2~3문장)",
  "brandEquivalentConcept": "치환에 사용된 브랜드 핵심 개념 (예: 비견·겁재 대운 과열)",
  "choiceMatrix": [
    "A. ...",
    "B. ...",
    "C. ..."
  ]
}
\`\`\`
`.trim();
}

export function parseTransposedResponse(
  rawResponse: string,
  skeleton: AbstractedTrendSkeleton,
  profile: BrandProfile
): TransposedViralCandidate {
  const trimmed = rawResponse.trim();

  const jsonMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || trimmed.match(/(\{[\s\S]*\})/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[1]);
      if (parsed && typeof parsed.hookHeadline === "string") {
        const rawChoices = Array.isArray(parsed.choiceMatrix) ? parsed.choiceMatrix : [];
        const optA = rawChoices[0] || skeleton.choiceOptions[0];
        const optB = rawChoices[1] || skeleton.choiceOptions[1];
        const optC = rawChoices[2] || skeleton.choiceOptions[2];

        return {
          skeletonId: skeleton.id,
          targetDomain: skeleton.domain,
          hookHeadline: String(parsed.hookHeadline).trim(),
          openingNarrative: String(parsed.openingNarrative || "").trim(),
          domainMapping: {
            originalConflict: skeleton.unspokenAnxiety,
            brandEquivalentConcept: String(parsed.brandEquivalentConcept || profile.coreTopics[0] || "대운 타이밍"),
          },
          choiceMatrix: [optA, optB, optC],
        };
      }
    } catch {
      // fallback
    }
  }

  // Fallback
  return {
    skeletonId: skeleton.id,
    targetDomain: skeleton.domain,
    hookHeadline: `${skeleton.headlineHook} - 사주 데이터로 까보면 나오는 패턴`,
    openingNarrative: `${skeleton.cognitiveDissonance}의 문제는 실력이 아니라 타이밍에 있음.`,
    domainMapping: {
      originalConflict: skeleton.unspokenAnxiety,
      brandEquivalentConcept: "대운 교운기 전환 타이밍",
    },
    choiceMatrix: skeleton.choiceOptions,
  };
}

export async function transposeSkeleton(
  skeleton: AbstractedTrendSkeleton,
  profile: BrandProfile,
  queryFn: (prompt: string) => Promise<string>
): Promise<TransposedViralCandidate> {
  const prompt = buildTranspositionPrompt(skeleton, profile);
  const response = await queryFn(prompt);
  return parseTransposedResponse(response, skeleton, profile);
}

export function mapCandidateToViralPatternData(
  candidate: TransposedViralCandidate,
  brandId: string
) {
  return {
    brandId,
    dimension: "transposed_hook",
    value: candidate.hookHeadline,
    sourceCount: 1,
    avgViralScore: 90,
    confidence: 85,
    exampleIds: JSON.stringify([candidate.skeletonId]),
    recommendation: `[${candidate.targetDomain}] ${candidate.domainMapping.brandEquivalentConcept} 기반 3지선다 훅`,
  };
}
