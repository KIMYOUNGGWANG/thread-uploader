import { describe, expect, it } from "vitest";
import { formatViralIntentModePrompt, NEW_YEAR_MODES, resolveViralIntentMode, VIRAL_INTENT_MODES } from "@/lib/viral-intent-modes";
import { DAY_MASTER_2027, MONTHS_2027, NEW_YEAR_TAGS } from "./new-year-2027-data";
import { buildNewYearBrief, buildNewYearLink, checkNewYearFacts, newYearFirstComment } from "./new-year-content";

describe("new year content", () => {
  it("ranking brief에 10개 일간과 각자의 결이 다 있다", () => {
    const brief = buildNewYearBrief("ny_ranking", "ko", 0);
    for (const [dm, { tag }] of Object.entries(DAY_MASTER_2027)) {
      expect(brief).toContain(dm);
      expect(brief).toContain(NEW_YEAR_TAGS[tag].ko);
    }
  });
  it("monthly brief에 12개 월주가 순서대로 있다", () => {
    const brief = buildNewYearBrief("ny_monthly", "ko", 0);
    const positions = MONTHS_2027.map((m) => brief.indexOf(m.pillar));
    expect(positions.every((p, i) => p >= 0 && (i === 0 || p > positions[i - 1]))).toBe(true);
  });
  it("한 줄에 다른 결의 일간이 섞이면 떨어진다", () => {
    expect(checkNewYearFacts("2027년 일간별로 바쁜 데가 달라\n갑목·을목: 할 말이 많아짐\n병화·임수: 사람이 늘어남", "ny_ranking", "ko"))
      .toEqual([expect.stringContaining("병화")]);
    expect(checkNewYearFacts("2027년 일간별로 바쁜 데가 달라\n갑목·을목: 할 말이 많아짐\n병화·정화: 사람이 늘어남", "ny_ranking", "ko")).toEqual([]);
  });
  it("틀린 월주는 떨어진다", () => {
    expect(checkNewYearFacts("5월 병오는 바쁜 달", "ny_monthly", "ko")).toEqual([expect.stringContaining("5월")]);
    expect(checkNewYearFacts("5월 을사, 6월 병오", "ny_monthly", "ko")).toEqual([]);
  });
  it("월주 검사는 월에 붙은 간지만 비교한다 (일상 단어·연도 간지는 통과)", () => {
    for (const ok of [
      "3월엔 갑자기 바빠져",
      "5월 정해진 일이 많아",
      "5월 임신 계획 있으면",
      "2월 4일 입춘부터 정미년",
      "1월 1일엔 아직 병오년",
      "1월은 아직 작년 병오해 흐름이야",
      "5·6월 을사·병오",
      "7월 정미월",
      "5월(을사)",
      "5월 을사(乙巳) — 2027-05-06부터",
    ]) {
      expect(checkNewYearFacts(ok, "ny_monthly", "ko"), ok).toEqual([]);
    }
    expect(checkNewYearFacts("5월(병오)", "ny_monthly", "ko")).toEqual([expect.stringContaining("5월")]);
    for (const bad of ["5월 병오(丙午)", "5월 병오:", "5월 병오 — x", "5월: 병오", "1월 임인.", "5월 병오!", "5월 = 병오", "5월 → 병오"]) {
      expect(checkNewYearFacts(bad, "ny_monthly", "ko"), bad).toEqual([expect.stringContaining("월 월주가 틀림")]);
    }
    expect(checkNewYearFacts("7월 을사월", "ny_monthly", "ko")).toEqual([expect.stringContaining("7월")]);
  });
  it("2026·2027 외 연도는 떨어진다", () => {
    expect(checkNewYearFacts("2028년엔 더 좋아짐", "ny_pick", "ko")).toEqual([expect.stringContaining("2028")]);
    expect(checkNewYearFacts("2027 and 2026 overlap", "ny_pick", "en")).toEqual([]);
    expect(checkNewYearFacts("In 2029 things change", "ny_pick", "en")).toEqual([expect.stringContaining("2029")]);
  });
  it("입춘 글은 입춘 날짜나 '입춘'을 말해야 한다", () => {
    expect(checkNewYearFacts("1월 신년운세는 사실 작년 운", "ny_ipchun", "ko")).not.toEqual([]);
    expect(checkNewYearFacts("사주의 해는 입춘부터 바뀜", "ny_ipchun", "ko")).toEqual([]);
    expect(checkNewYearFacts("The saju year turns on Feb 4", "ny_ipchun", "en")).toEqual([]);
    // normalizeIpchunSpelling rewrites Lichun to Ipchun before the gate runs.
    expect(checkNewYearFacts("In saju the year turns at Ipchun, not January 1", "ny_ipchun", "en")).toEqual([]);
    expect(checkNewYearFacts("The new year starts in January", "ny_ipchun", "en")).not.toEqual([]);
  });
  it("링크에 추적 파라미터가 다 붙는다", () => {
    const url = new URL(buildNewYearLink("post_1", "ny_ranking", "ko"));
    expect(url.origin + url.pathname).toBe("https://www.cosmicpath.app/2027/sample");
    expect(Object.fromEntries(url.searchParams)).toMatchObject({ source: "threads", utm_source: "threads", utm_campaign: "new_year_2027", pid: "post_1", fid: "ny_ranking" });
    expect(new URL(buildNewYearLink("p", "ny_pick", "en")).pathname).toBe("/en/2027/sample");
  });
  it("첫 댓글은 고정 문구 + 링크뿐이다", () => {
    expect(newYearFirstComment("ko", "https://x/r/1")).toBe("내 2027 캘린더, 샘플 먼저 보기:\nhttps://x/r/1");
    expect(newYearFirstComment("en", "https://x/r/1")).toBe("See a sample 2027 calendar first:\nhttps://x/r/1");
  });
  it("신년 모드 프롬프트는 첫 줄 사주 전제·지어낸 경험담을 요구하지 않는다", () => {
    for (const mode of Object.values(NEW_YEAR_MODES)) {
      expect(formatViralIntentModePrompt(mode)).not.toMatch(/본인 경험담으로|첫 줄에 .*일간/);
    }
  });
  it("신년 모드는 순환 밖이고 resolve가 돌려준다", () => {
    for (const [id, mode] of Object.entries(NEW_YEAR_MODES)) {
      expect(VIRAL_INTENT_MODES.some((m) => m.id === id)).toBe(false);
      expect(resolveViralIntentMode(id, 0)).toBe(mode);
    }
  });
});
