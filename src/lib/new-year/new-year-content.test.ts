import { describe, expect, it } from "vitest";
import { formatViralIntentModePrompt, NEW_YEAR_MODES, resolveViralIntentMode, VIRAL_INTENT_MODES } from "@/lib/viral-intent-modes";
import { DAY_MASTER_2027, MONTHS_2027, NEW_YEAR_TAGS } from "./new-year-2027-data";
import { buildNewYearBrief, buildNewYearLink, buildZodiacBrief, checkNewYearFacts, checkZodiacFacts, newYearFirstComment, zodiacTopicFor } from "./new-year-content";

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
    expect(checkNewYearFacts("2027년 일간별로 바쁜 데가 달라\n갑목·을목: 할 말이 많아짐\n병화·임수: 사람이 늘어남", "ny_ranking"))
      .toEqual([expect.stringContaining("병화")]);
    expect(checkNewYearFacts("2027년 일간별로 바쁜 데가 달라\n갑목·을목: 할 말이 많아짐\n병화·정화: 사람이 늘어남", "ny_ranking")).toEqual([]);
  });
  it("틀린 월주는 떨어진다", () => {
    expect(checkNewYearFacts("5월 병오는 바쁜 달", "ny_monthly")).toEqual([expect.stringContaining("5월")]);
    expect(checkNewYearFacts("5월 을사, 6월 병오", "ny_monthly")).toEqual([]);
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
      expect(checkNewYearFacts(ok, "ny_monthly"), ok).toEqual([]);
    }
    expect(checkNewYearFacts("5월(병오)", "ny_monthly")).toEqual([expect.stringContaining("5월")]);
    for (const bad of ["5월 병오(丙午)", "5월 병오:", "5월 병오 — x", "5월: 병오", "1월 임인.", "5월 병오!", "5월 = 병오", "5월 → 병오"]) {
      expect(checkNewYearFacts(bad, "ny_monthly"), bad).toEqual([expect.stringContaining("월 월주가 틀림")]);
    }
    expect(checkNewYearFacts("7월 을사월", "ny_monthly")).toEqual([expect.stringContaining("7월")]);
  });
  it("ny_monthly는 줄 단위로 그 달의 월주만 허용한다 (흔한 형식의 틀린 월주)", () => {
    for (const bad of [
      "5월 갑진 - 정리",
      "5월 갑진 기운이",
      "5월 갑진의 달",
      "5월 갑진에는",
      "5월은 갑진 흐름",
      "5월: 갑진 기운",
      "5월 → 갑진 기운",
      "5월 갑진 | 정리",
      "5월 을사, 6월 갑진 흐름",
      "갑진 기운의 5월",
    ]) {
      expect(checkNewYearFacts(bad, "ny_monthly"), bad).toEqual([expect.stringContaining("월 월주가 틀림: 갑진")]);
    }
    for (const ok of ["4월 갑진 - 정리", "5월은 을사 흐름", "5·6월 을사·병오 흐름", "5~7월 을사·병오·정미 기운", "5월 을사 | 6월 병오"]) {
      expect(checkNewYearFacts(ok, "ny_monthly"), ok).toEqual([]);
    }
  });
  it("EN 글도 같은 검사를 다 받는다", () => {
    expect(checkNewYearFacts("In saju the year turns at Ipchun (Feb 4), not January 1.", "ny_ipchun")).toEqual([]);
    expect(checkNewYearFacts("Month 5 is 5월(병오) for you", "ny_pick")).toEqual([expect.stringContaining("5월")]);
  });
  it("입춘·월별 글의 날짜는 1월 1일이나 절입일만 허용한다", () => {
    expect(checkNewYearFacts("입춘(2월 3일)부터 새해", "ny_ipchun")).toEqual([expect.stringContaining("2월 3일")]);
    expect(checkNewYearFacts("입춘은 2월 4일, 1월 1일이 아니야", "ny_ipchun")).toEqual([]);
    expect(checkNewYearFacts("5월 6일부터 을사월", "ny_monthly")).toEqual([]);
    expect(checkNewYearFacts("5월 5일부터 을사월", "ny_monthly")).toEqual([expect.stringContaining("5월 5일")]);
  });
  it("2027을 가리키는 연간지는 정미여야 한다", () => {
    for (const bad of [
      "2027년 병오년이 온다", "2027 병오년", "2027년(병오해)", "병오년(2027)",
      "2027년은 병오년이야", "2027년, 병오년", "2027 병오의 해",
    ]) {
      expect(checkNewYearFacts(`입춘 ${bad}`, "ny_ipchun"), bad).toEqual([expect.stringContaining("병오")]);
    }
    for (const ok of [
      "2026년 병오년", "병오년(2026)", "2027년 정미년", "2027 정미년",
      "2027년은 정미년", "2027년 갑자기 바빠짐", "2027년은 신년운세부터",
    ]) {
      expect(checkNewYearFacts(`입춘 ${ok}`, "ny_ipchun"), ok).toEqual([]);
    }
  });
  it("ranking 줄은 일간의 결과 다른 결의 키워드를 쓰면 떨어진다", () => {
    expect(checkNewYearFacts("갑목: 돈 흐름이 바빠지는 해", "ny_ranking")).toEqual([expect.stringContaining("갑목")]);
    expect(checkNewYearFacts("갑목·을목: 돈 흐름이 바빠지는 해", "ny_ranking")).toEqual([expect.stringContaining("갑목")]);
    expect(checkNewYearFacts("갑목·을목: 할 말이 많아지는 해", "ny_ranking")).toEqual([]);
    expect(checkNewYearFacts("임수·계수: 돈이 들고 나는 해\n경금: 책임이 생기는 해", "ny_ranking")).toEqual([]);
  });
  it("EN pick 자료에는 한글이 없다", () => {
    for (const i of [0, 1, 2]) expect(buildNewYearBrief("ny_pick", "en", i)).not.toMatch(/[가-힣]/);
    expect(buildNewYearBrief("ny_ipchun", "en", 0)).not.toMatch(/[가-힣]/);
  });
  it("2026·2027 외 연도는 떨어진다", () => {
    expect(checkNewYearFacts("2028년엔 더 좋아짐", "ny_pick")).toEqual([expect.stringContaining("2028")]);
    expect(checkNewYearFacts("2027 and 2026 overlap", "ny_pick")).toEqual([]);
    expect(checkNewYearFacts("In 2029 things change", "ny_pick")).toEqual([expect.stringContaining("2029")]);
  });
  it("입춘 글은 입춘 날짜나 '입춘'을 말해야 한다", () => {
    expect(checkNewYearFacts("1월 신년운세는 사실 작년 운", "ny_ipchun")).not.toEqual([]);
    expect(checkNewYearFacts("사주의 해는 입춘부터 바뀜", "ny_ipchun")).toEqual([]);
    expect(checkNewYearFacts("The saju year turns on Feb 4", "ny_ipchun")).toEqual([]);
    // normalizeIpchunSpelling rewrites Lichun to Ipchun before the gate runs.
    expect(checkNewYearFacts("In saju the year turns at Ipchun, not January 1", "ny_ipchun")).toEqual([]);
    expect(checkNewYearFacts("The new year starts in January", "ny_ipchun")).not.toEqual([]);
  });
  it("링크는 홈페이지로 가고 추적 파라미터가 다 붙는다", () => {
    const url = new URL(buildNewYearLink("post_1", "ny_ranking", "ko"));
    expect(url.origin + url.pathname).toBe("https://www.cosmicpath.app/");
    expect(Object.fromEntries(url.searchParams)).toMatchObject({ ref: "threads", utm_source: "threads", utm_campaign: "new_year_2027", pid: "post_1", fid: "ny_ranking" });
    const en = new URL(buildNewYearLink("p", "ny_pick", "en"));
    expect(en.pathname).toBe("/");
    expect(en.searchParams.get("lang")).toBe("en");
    expect(en.searchParams.get("pid")).toBe("p");
  });
  it("첫 댓글은 홈 맨 위 2027 캘린더로 안내하는 고정 문구 + 링크뿐이다", () => {
    expect(newYearFirstComment("ko", "https://x/r/1")).toBe("내 2027 캘린더는 홈 맨 위에서:\nhttps://x/r/1");
    expect(newYearFirstComment("en", "https://x/r/1")).toBe("Your 2027 calendar is at the top of the home page:\nhttps://x/r/1");
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

describe("zodiac (ny_zodiac) content", () => {
  const KO_OK = [
    "2027년, 사람이 들어오기 쉬운 띠가 있어",
    "띠로 보는 사주 이야기야",
    "돼지띠 (95·83·71·07년생): 사람이 들어오기 쉬운 해",
    "토끼띠 (99·87·75년생): 새 인연이 붙기 쉬운 해",
    "말띠 (02·90·78년생): 사람이 늘기 쉬운 해",
    "사주에선 입춘(2월 4일)부터 띠를 바꿔 봐서 1월~2월 초생이면 앞 해 띠일 수 있어",
    "가족 띠도 찾아서 보내 줘",
  ].join("\n");
  const EN_OK = [
    "Some zodiac signs meet more people in 2027.",
    "2027 is the Year of the Fire Goat.",
    "Pig (born 1971, 1983, 1995, 2007): new people are likely.",
    "Rabbit (born 1975, 1987, 1999): new ties come easier.",
    "Horse (born 1978, 1990, 2002): your circle may grow.",
    "In saju the year turns at Ipchun (Feb 4), so early-February birthdays may count as the year before.",
  ].join("\n");

  it("주제 순환", () => {
    expect(zodiacTopicFor(0).id).toBe("money");
    expect(zodiacTopicFor(5).id).toBe("harmony");
    expect(zodiacTopicFor(40).id).toBe("money");
  });
  it("brief에는 그 주제 띠와 출생년도만 있다", () => {
    const ko = buildZodiacBrief("ko", 5).join("\n");
    expect(ko).toContain("돼지띠 (95·83·71·07년생)");
    expect(ko).not.toContain("쥐띠");
    expect(ko).toContain("입춘");
    const en = buildZodiacBrief("en", 5).join("\n");
    expect(en).toContain("Pig (born 1971, 1983, 1995, 2007)");
    expect(en).toContain("Ipchun");
  });
  it("올바른 KO·EN 글은 통과", () => {
    expect(checkZodiacFacts(KO_OK, 5)).toEqual([]);
    expect(checkZodiacFacts(EN_OK, 5)).toEqual([]);
  });
  it("주제 밖 띠·연도 불일치·범위 밖·첫 줄 띠·안내 없음·순위는 실패", () => {
    expect(checkZodiacFacts(KO_OK.replace("말띠 (02·90·78년생)", "쥐띠 (96·84·72년생)"), 5)).toEqual([expect.stringContaining("다른 주제의 띠")]);
    expect(checkZodiacFacts(KO_OK.replace("95·83·71·07", "96·83·71·07"), 5)).toEqual([expect.stringContaining("불일치")]);
    expect(checkZodiacFacts(KO_OK.replace("95·83·71·07", "59·83·71·07"), 5)).toEqual([expect.stringContaining("불일치")]);
    expect(checkZodiacFacts(`돼지띠 주목\n${KO_OK}`, 5)).toEqual([expect.stringContaining("첫 줄")]);
    expect(checkZodiacFacts(KO_OK.replace(/사주에선.*\n/, ""), 5)).toEqual([expect.stringContaining("띠 기준 안내")]);
    expect(checkZodiacFacts(KO_OK.replace("돼지띠", "1위 돼지띠"), 5)).toEqual([expect.stringContaining("순위")]);
    // 1991은 줄 불일치와 허용 연도 위반 둘 다에 걸린다.
    expect(checkZodiacFacts(EN_OK.replace("1990", "1991"), 5)).toEqual(expect.arrayContaining([expect.stringContaining("불일치")]));
    expect(checkZodiacFacts(`${EN_OK}\nBorn in 1985? Check again.`, 5)).toEqual([expect.stringContaining("1985")]);
  });
  it("일반 단어·해 이름·별칭은 띠로 잘못 세지 않는다", () => {
    expect(checkZodiacFacts(`${KO_OK}\n말이 많아지는 해, 소소한 개인 일정도 챙겨`, 5)).toEqual([]);
    expect(checkZodiacFacts(`${KO_OK}\n2026년 말띠 해가 지나고 2027년은 양띠 해야`, 5)).toEqual([]);
    expect(checkZodiacFacts(`${EN_OK}\nThe 2026 Fire Horse year is ending.`, 5)).toEqual([]);
    const tiger = buildZodiacBrief("ko", 10).join("\n"); // express 주제(호랑이·토끼)
    expect(tiger).toContain("호랑이띠");
    expect(checkZodiacFacts("2027년, 말과 재주를 꺼내기 쉬운 띠\n범띠 (98·86·74년생): 표현이 늘기 쉬운 해\n토끼띠 (99·87·75년생): 재주를 꺼내기 쉬운 해\n띠로 보는 사주, 입춘부터 띠를 바꿔 봐", 10)).toEqual([]);
  });
});
