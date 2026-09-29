import { describe, it, expect } from "vitest";
import { checkQuality } from "./quality-gate";

describe("Global Brand Guard & Zero Hangul Quality Gate", () => {
  it("rejects English D2C content containing Korean characters", () => {
    const contaminatedPost = `Why your Moon sign keeps falling for emotionally unavailable partners.
당신의 29세 토성 귀환이 느려 죽는 이유는 조직 때문이 아니다.
Instead of surface Western astrology, look into your Eastern Day Master.`;

    const result = checkQuality(contaminatedPost, "ecommerce_d2c");
    expect(result.pass).toBe(false);
    expect(result.reasons.some((r) => r.includes("Zero Hangul 위반"))).toBe(true);
  });

  it("rejects content containing generated meta markdown slop (# 📌 THREADS POST)", () => {
    const slopPost = `# 📌 THREADS POST
Your birth chart is probably a lie.
Standard time zones are an 1884 railroad convention—not nature's clock.
Stop checking your Western horoscope if you actually want real answers.`;

    const result = checkQuality(slopPost, "ecommerce_d2c");
    expect(result.pass).toBe(false);
    expect(result.reasons.some((r) => r.includes("generated meta text 포함"))).toBe(true);
  });

  it("rejects content containing '--- **본문**' markdown headers", () => {
    const headerSlopPost = `--- **본문**
Stop checking your Western horoscope if you actually want answers.
In Western astrology, Sun tells people how you shine.
In Korean Saju, Day Master reveals who you are when nobody is watching.`;

    const result = checkQuality(headerSlopPost, "ecommerce_d2c");
    expect(result.pass).toBe(false);
    expect(result.reasons.some((r) => r.includes("generated meta text 포함"))).toBe(true);
  });

  it("passes high-retention English D2C contrasting post with no Hangul or slop", () => {
    const cleanPost = `Your birth chart is probably a lie.

Standard time zones are an 1884 railroad convention—not nature's clock. Most people are 15-45 minutes off their true solar time.

In Western astrology, Sun tells people how you shine. In Korean Saju, Day Master reveals who you are when nobody is watching.

Are you fighting the illusion or ready for the truth?`;

    const result = checkQuality(cleanPost, "ecommerce_d2c");
    if (!result.pass) console.log("CLEAN POST RESULT:", JSON.stringify(result, null, 2));
    expect(result.pass).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(2);
    expect(result.reasons).toEqual([]);
  });

  it("enforces Zero Hangul when context.isEnglish is true even for default profiles", () => {
    const mixedPost = `Western astrology tells you you are a Pisces.
그런데 실제 사주로는 완전 다른 기질입니다.
Check your true natal chart.`;

    const result = checkQuality(mixedPost, "saju_viral", { isEnglish: true });
    expect(result.pass).toBe(false);
    expect(result.reasons.some((r) => r.includes("Zero Hangul 위반"))).toBe(true);
  });
});
