# CLAUDE.md — Orchestrator 6.1

## Identity
이 저장소는 완성된 앱 템플릿이 아니라 AI 작업용 운영 허브다.
연결된 클라이언트 프로젝트에서는 Next.js/Supabase 기반 기본 스택을 권장하지만, 허브 자체는 Bash/Markdown/JSON 중심으로 동작한다.

## Rules
- 문서에 적힌 명령은 실제로 존재해야 한다. 없는 명령을 안내하지 않는다.
- 허브 수정 시 먼저 관련 스크립트와 워크플로우를 읽고, 완료 전 `bash -n .agent/scripts/*.sh` 또는 동등한 검증을 수행한다.
- 클라이언트 앱 코드를 다룰 때는 `any` 금지, Zod 검증, RSC 기본 원칙을 따른다.
- 함수 < 20줄, SRP, 축약어 금지 (`req`→`request`, `res`→`response`)
- API/DB 호출은 방어적으로 작성하고, 계약 문서와 일치시킨다.

## Skills
`.claude/skills/` (symlink → `.agents/skills/`). **필요 시 on-demand로 읽기**:
```bash
bash .agent/scripts/smart-skill-loader.sh "<keyword>" --concat --strict
cat .agent/memory/current_loaded_skills.md
```

## Contract
- 허브 자체: `README.md`, 워크플로우 문서, 스크립트가 운영 계약이다.
- 클라이언트 앱: `docs/api-spec.md` 가 단일 진실 공급원이다. 없으면 `/plan` 먼저 실행한다.

## Memory
- `.agent/memory/task_board.md` — 현재 미션 및 진행률
- `.agent/memory/learnings.md` — 과거 실수 (반복 금지)

## Commands
- `/plan` → `/develop` → `/uiux` → `/ship`
- `/fix`: 버그 수정 | `/test`: 테스트 | `/status`: 상태 확인

## Communication
- 보고/요약은 **한국어**로 작성
