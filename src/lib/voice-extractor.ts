import type { VoiceProfile } from "@/types/brand";

/**
 * Voice Extractor
 *
 * Charlie Hills의 voice-builder 원리를 기반으로 작성된 보이스 프로파일 추출기.
 * 입력된 3~5개 이상의 포스트 샘플에서:
 * 1. 문장 평균 길이 (short_punchy / balanced / detailed)
 * 2. 문단 줄바꿈 리듬 (single_line_breath / compact_blocks)
 * 3. 어조 (assertive / conversational / provocative / analytical)
 * 4. 1인칭 화자 관점 (perspective)
 * 5. 솔직 고백형 스타일 (admissionStyle)
 * 을 정량/정성적으로 추출한다.
 */

export function extractVoiceProfile(samples: string[]): VoiceProfile {
  const cleanSamples = samples
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  if (cleanSamples.length === 0) {
    return {
      tone: "conversational",
      perspective: "창작자 / 실무자",
      sentenceLength: "short_punchy",
      paragraphStyle: "single_line_breath",
      admissionStyle: "사실 나도 매번 흔들리고 고민한다.",
      forbiddenPhrases: [],
    };
  }

  // 1. 문장 길이 분석
  const allSentences: string[] = [];
  let totalParagraphLines = 0;
  let singleLineBreaks = 0;

  for (const sample of cleanSamples) {
    const lines = sample.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);
    totalParagraphLines += lines.length;
    for (const line of lines) {
      allSentences.push(line);
      // Threads 특유의 1줄 띄기 분석
      if (line.length <= 45) {
        singleLineBreaks++;
      }
    }
  }

  const avgSentenceChars = allSentences.length > 0
    ? allSentences.reduce((sum, s) => sum + s.length, 0) / allSentences.length
    : 35;

  const sentenceLength: VoiceProfile["sentenceLength"] =
    avgSentenceChars < 35
      ? "short_punchy"
      : avgSentenceChars < 65
      ? "balanced"
      : "detailed";

  const paragraphStyle: VoiceProfile["paragraphStyle"] =
    singleLineBreaks / (allSentences.length || 1) >= 0.5
      ? "single_line_breath"
      : "compact_blocks";

  // 2. 어조 (Tone) 분석
  const fullText = cleanSamples.join("\n");

  const assertiveCount = (fullText.match(/(다\.|하라|하지 마|절대|결코|진짜 문제는)/g) || []).length;
  const provocativeCount = (fullText.match(/(착각|틀렸다|망하는|최악|사기|거짓말)/g) || []).length;
  const analyticalCount = (fullText.match(/(데이터|지표|이유|원인|분석|정리|기준)/g) || []).length;

  let tone: VoiceProfile["tone"] = "conversational";
  if (provocativeCount >= 3) {
    tone = "provocative";
  } else if (assertiveCount >= 5) {
    tone = "assertive";
  } else if (analyticalCount >= 5) {
    tone = "analytical";
  }

  // 3. 화자 관점 (Perspective) 추출
  let perspective = "업계 실무자";
  if (/(창업|대표|비즈니스|매출|고객)/.test(fullText)) {
    perspective = "창업가 / 비즈니스 빌더";
  } else if (/(사주|운세|팔자|명리)/.test(fullText)) {
    perspective = "사주 명리 상담가";
  } else if (/(퇴사|이직|커리어|연봉|직장)/.test(fullText)) {
    perspective = "커리어 의사결정 멘토";
  } else if (/(개발|코딩|엔지니어)/.test(fullText)) {
    perspective = "개발자 / 테크 빌더";
  }

  // 4. 솔직 고백형 (Admission) 스타일
  let admissionStyle = "사실 완벽한 정답은 나도 모른다.";
  if (tone === "provocative" || tone === "assertive") {
    admissionStyle = "나도 예전엔 똑같이 삽질하고 당했다.";
  } else if (tone === "analytical") {
    admissionStyle = "나 역시 데이터 보기 전엔 내 직관을 맹신했다.";
  }

  // 5. 금지 어투 (AI Slop 단어 자동 추가)
  const forbiddenPhrases = [
    "좋은 하루 보내세요",
    "함께 알아볼까요",
    "도움이 되셨다면",
    "작은 실천이 큰 변화를 만듭니다",
    "언젠가 다 잘될 거예요",
  ];

  return {
    tone,
    perspective,
    sentenceLength,
    paragraphStyle,
    admissionStyle,
    forbiddenPhrases,
  };
}
