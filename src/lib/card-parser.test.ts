import { describe, it, expect } from "vitest";
import { parsePostForCard, parsePostForSlide } from "./card-parser";

describe("card-parser", () => {
  it("extracts hook, sub, and items from a standard post", () => {
    const content = `결산 직후 입사한 시니어 아키텍트들 보면 다 같은 패턴이야.
회사 실적 안 나면 넌 스케이프고트가 되고, 운세 앱은 "올해 대박"이라고만 해.

진짜 문제는 타이밍이 겹쳤다는 거야. 대운 교운기인데 조직 에너지가 하강 중이면? 통장이 많아도 빠져나가.

체크해봐.

▶ A. 버팀형: 3년 더 존버하면 직급 올라와 (근데 멘탈이 버틸까?)
▶ B. 이동형: 좋은 회사 제안 들어왔어 (근데 또 반복돼)
▶ C. 준비형: 통장 모아서 대기 중 (기간만 낭비)

👉 당신은 지금 A/B/C 중 어디에 가까워?`;

    const parsed = parsePostForCard(content);
    expect(parsed.hook).toBe("결산 직후 입사한 시니어 아키텍트들 보면 다 같은 패턴이야.");
    expect(parsed.sub).toContain("회사 실적 안 나면");
    expect(parsed.items.length).toBe(3);
    expect(parsed.items[0]).toContain("A. 버팀형");
    expect(parsed.items[1]).toContain("B. 이동형");
    expect(parsed.items[2]).toContain("C. 준비형");
  });

  it("handles markdown slide separators (---) for multi-slide carousel", () => {
    const multiSlideContent = `Slide 1 Hook
Sub headline for slide 1
---
Slide 2 Title
Detailed breakdown of point A
---
Slide 3 Solution
Take action now`;

    const slide0 = parsePostForSlide(multiSlideContent, 0);
    expect(slide0.hook).toBe("Slide 1 Hook");
    expect(slide0.sub).toBe("Sub headline for slide 1");

    const slide1 = parsePostForSlide(multiSlideContent, 1);
    expect(slide1.hook).toBe("Slide 2 Title");
    expect(slide1.sub).toBe("Detailed breakdown of point A");

    const slide2 = parsePostForSlide(multiSlideContent, 2);
    expect(slide2.hook).toBe("Slide 3 Solution");
    expect(slide2.sub).toBe("Take action now");
  });

  it("falls back to item-based slides when slideIndex > 0 without explicit separators", () => {
    const content = `메인 훅 타이틀
서브 설명입니다.

A. 첫번째 옵션 설명
B. 두번째 옵션 설명
C. 세번째 옵션 설명`;

    const slide1 = parsePostForSlide(content, 1);
    expect(slide1.hook).toContain("A. 첫번째 옵션");
    expect(slide1.isCarouselDetail).toBe(true);

    const slide2 = parsePostForSlide(content, 2);
    expect(slide2.hook).toContain("B. 두번째 옵션");
  });
});
