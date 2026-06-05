---
name: debugging-strategies
description: Root-cause-first debugging patterns including 5-Why, binary search isolation, compare-good-vs-bad, and safe hypothesis testing.
---

# Debugging Strategies

원인 미상 버그를 빠르게 때우지 않고 재발 방지까지 연결하기 위한 디버깅 전략 모음.

## When To Use

- 증상은 보이지만 원인이 명확하지 않을 때
- 같은 파일을 반복 수정하게 될 때
- 로그를 늘려도 방향이 잡히지 않을 때
- `/investigate` 또는 `/fix`에서 root cause를 잠글 때

## Core Rules

- 수정 전에 가설 3개를 적는다.
- 가장 쉬운 반증 실험부터 한다.
- 한 번에 한 변수만 바꾼다.
- 범위를 모르면 먼저 좁히고, 좁힐 수 없으면 수정하지 않는다.

## Strategy 1: 5-Why

문제를 증상에서 시스템 원인까지 파고들 때 쓴다.

```text
증상 -> 왜? -> 왜? -> 왜? -> 왜? -> 왜?
```

예시:

```text
로그인이 실패한다
-> 왜? 세션 토큰이 저장되지 않는다
-> 왜? callback response가 500이다
-> 왜? env key가 누락됐다
-> 왜? preview 배포 env가 동기화되지 않았다
-> 왜? env sync checklist가 ship gate에 없었다
```

## Strategy 2: Binary Search Isolation

범위가 넓을 때 절반씩 잘라서 원인을 찾는다.

- 프론트 vs 백엔드
- API vs DB
- 특정 commit 이전 vs 이후
- 특정 component tree 상단 vs 하단

질문 형식:

```text
이 레이어는 정상인가?
정상이면 아래 절반, 비정상이면 위 절반을 본다.
```

## Strategy 3: Compare Good vs Bad

정상 케이스와 비정상 케이스를 나란히 비교한다.

- 요청 payload 차이
- 응답 상태 코드 차이
- env / role / locale / feature flag 차이
- DOM state / query params / auth context 차이

비교 표:

```md
| Signal | Good | Bad | Difference |
|--------|------|-----|------------|
| role   | admin | member | permission boundary |
```

## Strategy 4: Boundary Tracing

데이터가 경계를 넘을 때 깨지는 문제를 추적한다.

- input -> parser
- action -> route
- route -> DB
- DB -> serializer
- serializer -> UI

각 경계마다 아래를 확인한다.

- 들어온 값
- 변환 규칙
- 나간 값
- 실패 시 fallback

## Strategy 5: Invariant Check

항상 참이어야 하는 조건을 선언하고 깨지는 지점을 찾는다.

예시 invariant:

- 인증된 사용자는 `userId`가 항상 존재한다.
- API 응답은 spec field를 빠뜨리지 않는다.
- destructive action은 confirmation step을 거친다.

## Hypothesis Table

`/investigate` 에서는 최소 아래 표를 만든다.

```md
| Hypothesis | Evidence | How to falsify | Result |
|------------|----------|----------------|--------|
| ... | ... | ... | open |
```

## Red Flags

- 로그만 늘리고 판단 기준이 없다.
- 원인 불명인데 patch부터 넣는다.
- 같은 파일을 세 번 이상 만지면서 가설이 바뀌지 않는다.
- external service 탓으로 넘기고 local evidence를 안 본다.

## Handoff

- 원인 미확정이면 `/investigate`
- 원인 확정 후 수리면 `/fix`
- 구조적 리스크면 `learnings.md` 와 `/review` 로 확장
