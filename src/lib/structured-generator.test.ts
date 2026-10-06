import { describe, it, expect } from "vitest";
import {
  parseStructuredPostOutput,
  generateCardUrlsForPost,
  buildStructuredPromptInstructions,
} from "./structured-generator";
import { resolveBrandProfile } from "./brand-profile";

describe("structured-generator", () => {
  it("parses valid JSON response block from LLM", () => {
    const rawLlmResponse = `Here is the post:
\`\`\`json
{
  "content": "대운 바뀔 때 돈부터 나가는 사람들의 공통점.\\n진술축미 깔린 사람들은 특히 조심해.\\n\\n▶ A. 버팀형\\n▶ B. 이동형\\n▶ C. 준비형",
  "firstComment": "📍 [무료] 내 사주 대운 진단하기:\\nhttps://www.cosmicpath.app",
  "format": "SINGLE_CARD",
  "topic": "대운과 재물선",
  "hookType": "contrast",
  "ctaType": "self_selection",
  "viralIntentModeId": "identity_profile",
  "cardSlides": [
    {
      "title": "대운 바뀔 때 돈부터 나가는 사람들의 공통점",
      "sub": "진술축미 깔린 사람들은 특히 조심해",
      "items": ["A. 버팀형", "B. 이동형", "C. 준비형"]
    }
  ]
}
\`\`\``;

    const parsed = parseStructuredPostOutput(rawLlmResponse);
    expect(parsed.content).toContain("대운 바뀔 때 돈부터 나가는");
    expect(parsed.firstComment).toContain("https://www.cosmicpath.app");
    expect(parsed.format).toBe("SINGLE_CARD");
    expect(parsed.cardSlides?.length).toBe(1);
  });

  it("gracefully falls back when LLM outputs legacy text format with separator", () => {
    const legacyResponse = `대운 바뀔 때 돈부터 나가는 사람들의 특징.
진술축미 깔린 사람 체크해봐.

A. 버팀형
B. 이동형
C. 준비형
===FIRST_COMMENT===
첫 댓글 링크입니다.`;

    const parsed = parseStructuredPostOutput(legacyResponse);
    expect(parsed.content).toContain("대운 바뀔 때");
    expect(parsed.firstComment).toBe("첫 댓글 링크입니다.");
    expect(parsed.format).toBe("SINGLE_CARD");
  });

  it("generates correct card URLs based on format and slide count", () => {
    const singleUrls = generateCardUrlsForPost("post-123", "https://app.com", "SINGLE_CARD", 1);
    expect(singleUrls).toEqual(["https://app.com/api/cards/post-123"]);

    const carouselUrls = generateCardUrlsForPost("post-456", "https://app.com", "CAROUSEL", 3);
    expect(carouselUrls).toEqual([
      "https://app.com/api/cards/post-456?slide=0",
      "https://app.com/api/cards/post-456?slide=1",
      "https://app.com/api/cards/post-456?slide=2",
    ]);

    const textOnlyUrls = generateCardUrlsForPost("post-789", "https://app.com", "TEXT_ONLY", 0);
    expect(textOnlyUrls).toEqual([]);
  });

  it("builds prompt instructions with brand persona and JSON schema requirements", () => {
    const profile = resolveBrandProfile("{}", "cosmicpath", "CosmicPath");
    const instruction = buildStructuredPromptInstructions(profile, "CAROUSEL");

    expect(instruction).toContain("valid JSON object");
    expect(instruction).toContain("cardSlides");
    expect(instruction).toContain(profile.persona);
  });
});
