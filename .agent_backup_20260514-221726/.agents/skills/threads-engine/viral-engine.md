---
name: viral-engine
description: Generate viral Threads posts. Reads brand-voice.md, selects stunt strategy, runs generate-batch.mjs (draft generation), applies Expert Panel quality gate (90+ score), outputs threads-uploader ready MD file.
---

# /viral-engine — 바이럴 포스트 생성

## 사전 조건 확인

`.agent/memory/brand-voice.md`가 존재하는지 Read 툴로 확인.
없으면 즉시 중단:
> "brand-voice.md가 없습니다. 먼저 `/viral-setup`을 실행해주세요."

## Phase 1 — 전략 선택

`.agent/memory/brand-voice.md`를 읽고 `## 추천 스턴트 템플릿` 섹션을 표시.
`## 성과 히스토리`가 있으면 잘 된 스턴트를 강조.

유저에게:
> "이번 배치에 어떤 전략을 쓸까요?
> 1. {추천 스턴트 1}
> 2. {추천 스턴트 2}
> 3. {추천 스턴트 3}
> 4. 자동 선택
> 번호를 입력해줘."

## Phase 2 — 포스트 초안 생성

선택된 전략으로 Bash 툴로 generate-batch.mjs 실행:

```bash
node scripts/generate-batch.mjs \
  --brand .agent/memory/brand-voice.md \
  --count 60 \
  --stunt "{선택된 스턴트명}" \
  --output output/$(date +%Y-%m-%d)-draft.md
```

실행 완료 후 생성된 draft.md를 Read 툴로 읽는다.

## Phase 3 — Expert Panel 품질 게이트

`references/expert-panel.md`를 읽어 채점 기준 로드.

초안의 각 포스트를 **5개씩 묶어** 채점한다 (토큰 효율).

각 묶음마다:
1. 3개 페르소나(Roy Lee / 타깃 유저 / 편집장)로 각 포스트 0-100점 채점
2. 24 AI slop 패턴 전수 검사
3. 평균 90점 미만 → 재작성 지시 (구체적 이유 포함)
4. 재작성 후 재채점 → 여전히 미달이면 폐기 표시

## Phase 4 — 최종 출력

통과한 포스트만 모아 최종 파일 생성.
Write 툴로 `output/YYYY-MM-DD-{브랜드명}-posts.md` 작성.

파일 헤더:
```
# {브랜드명} Threads 포스트 (통과: {N}개)
> 생성일시: {날짜}
> 스턴트: {선택된 스턴트}
> Expert Panel 통과: {통과 수}/{전체 수}
```

각 포스트 포맷 (threads-uploader 호환):
```
---

## 포스트 {번호}
<!-- formula:{공식id} stunt:{스턴트} score:{평균점수} -->

{포스트 본문}

> **💬 첫 댓글 (골든타임용)**
>
> {첫 댓글}
```

## Phase 5 — 완료 메시지

> "✅ {N}개 포스트 생성 완료
> → output/YYYY-MM-DD-{브랜드명}-posts.md
>
> threads-uploader에서 업로드:
> POST /api/posts/upload 에 이 파일을 투입하세요.
>
> 2주 후 /viral-retro로 성과 분석을 실행하면 다음 배치가 더 정확해집니다."
