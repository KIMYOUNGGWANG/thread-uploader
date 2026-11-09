import { describe, expect, it } from "vitest";
import { buildCardCaption, buildVideoCaption } from "./captions";

describe("buildVideoCaption", () => {
  const captions = JSON.stringify({ instagram: "인스타 #사주", youtube: "유튜브", tiktok: "틱톡" });
  const hashtags = JSON.stringify(["사주", "#일간", "cosmic path"]);

  it("adds hashtags not already in the caption and the suffix", () => {
    expect(buildVideoCaption("instagram", captions, hashtags, "프로필 링크")).toBe("인스타 #사주\n\n#일간 #cosmicpath\n\n프로필 링크");
  });

  it("falls back to hashtags alone when the channel caption is missing", () => {
    expect(buildVideoCaption("youtube", "{}", hashtags)).toBe("#사주 #일간 #cosmicpath");
  });
});

describe("buildCardCaption", () => {
  it("uses the first two paragraphs", () => {
    expect(buildCardCaption("하나\n\n둘\n\n셋", "끝")).toBe("하나\n\n둘\n\n끝");
  });
});
