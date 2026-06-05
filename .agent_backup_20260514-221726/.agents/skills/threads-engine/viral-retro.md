---
name: viral-retro
description: Analyze Threads post performance and update brand-voice.md. Run every 2 weeks after publishing a batch. Accepts any format of performance data (numbers, screenshots, vibes).
---

# /viral-retro — 성과 분석 + 학습 반영

발행한 포스트의 성과를 분석하고 다음 배치 전략을 개선한다.

## 데이터 수집

`.agent/memory/brand-voice.md`를 Read 툴로 읽어 이전 배치 정보 확인.

유저에게:
> "지난 배치 성과 데이터를 붙여넣어줘.
> 수치, 스크린샷 설명, '이게 터진 것 같아' 같은 느낌도 다 괜찮아."

## 분석 프레임워크

받은 데이터에서 5가지를 추출:

**1. 공식별 성과**
`references/post-formulas.md`의 9개 공식 중 어떤 것이 가장 높은 반응을 얻었는가.
조회수 / 저장수 / 댓글수 기준으로 순위 매기기.

**2. 스턴트 템플릿별 성과**
`references/viral-principles.md`의 8개 스턴트 중 어떤 것이 공유/저장을 유발했는가.

**3. 주제별 반응**
어떤 주제(타깃/상황/문제)가 댓글 폭발을 일으켰는가.

**4. 역학습 (의외의 히트)**
탈락할 것 같았는데 의외로 터진 것. 이유 분석.

**5. 다음 배치 전략 추천**
위 분석 기반으로:
- 다음에 집중할 공식 Top 3
- 다음에 피할 공식
- 추천 스턴트 템플릿 업데이트

## brand-voice.md 업데이트

`.agent/memory/brand-voice.md`의 `## 성과 히스토리` 테이블에 행 추가:

```
| {오늘 날짜} | {배치번호} | {공식 우승} | {스턴트 우승} | {주요 인사이트} |
```

성과 기반으로 `## 추천 스턴트 템플릿` 순위도 업데이트.

## 완료

> "✅ brand-voice.md 업데이트 완료.
> 다음 /viral-engine 실행 시 이 학습이 반영됩니다.
>
> **핵심 인사이트:**
> - 가장 잘 된 공식: {공식명}
> - 가장 잘 된 스턴트: {스턴트명}
> - 다음에 집중할 것: {추천}
> - 피할 것: {비추}"
