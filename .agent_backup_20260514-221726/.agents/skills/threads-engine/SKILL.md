---
name: threads-engine
description: Threads 바이럴 마케팅 스킬. /threads-engine 하나로 setup/generate/retro 모두 실행. 처음이면 브랜드 설정, 이후엔 포스트 배치 생성 또는 성과 분석.
---

# /threads-engine

## 시작 시 항상 실행

1. **(중요)** 현재 작업 중인 클라이언트 프로젝트 루트 디렉토리(예: `new_idea` 또는 `stellar_dreams`)를 식별한다.
2. 해당 프로젝트 내의 `.agent/memory/brand-voice.md`가 존재하는지 절대경로를 기반으로 명확히 Read 툴로 확인한다.
   *(오케스트레이터 허브의 메모리를 읽거나 덮어쓰지 않도록 주의)*

3. **없으면** → 자동으로 `threads-engine/viral-setup` 스킬을 Skill 툴로 호출한다. (질문 없이 바로)

4. **있으면** → 유저에게 묻는다:

> "뭘 할까?
> 1. 포스트 배치 생성 (threads-engine) — 새 포스트 60개 생성 + Expert Panel 검증
> 2. 성과 분석 (viral-retro) — 지난 배치 성과 입력 → brand-voice.md 업데이트
> 3. 브랜드 설정 재작성 (viral-setup) — brand-voice.md 처음부터 다시"

선택에 따라:
- `1` → Skill 툴로 `threads-engine/viral-engine` 호출
- `2` → Skill 툴로 `threads-engine/viral-retro` 호출
- `3` → Skill 툴로 `threads-engine/viral-setup` 호출
