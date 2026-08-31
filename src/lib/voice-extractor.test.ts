import { describe, expect, it } from "vitest";
import { extractVoiceProfile } from "@/lib/voice-extractor";

describe("extractVoiceProfile", () => {
  it("extracts short punchy sentence length and single line breathing style", () => {
    const samples = [
      "퇴사 타이밍?\n느낌으로 정하면 무조건 후회한다.\n반복된 신호부터 적어봐.",
      "이직 밀기 전에 3가지만 확인해.\n1. 조건\n2. 에너지\n3. 다음 선택지.\n저장해두고 다시 봐.",
    ];

    const profile = extractVoiceProfile(samples);

    expect(profile.sentenceLength).toBe("short_punchy");
    expect(profile.paragraphStyle).toBe("single_line_breath");
    expect(profile.perspective).toContain("커리어");
  });

  it("extracts provocative tone when strong words are present", () => {
    const samples = [
      "너희가 아는 성공 법칙은 전부 착각이다.",
      "이 방식으로 일하면 최악의 결과를 맞이하고 망하는 지름길이다.",
      "틀렸다. 남들 말 듣지 말고 네 데이터만 봐라.",
    ];

    const profile = extractVoiceProfile(samples);

    expect(profile.tone).toBe("provocative");
    expect(profile.admissionStyle).toContain("삽질");
  });

  it("handles empty samples with clean fallback profile", () => {
    const profile = extractVoiceProfile([]);
    expect(profile.tone).toBe("conversational");
    expect(profile.forbiddenPhrases.length).toBe(0);
  });
});
