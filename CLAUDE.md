# CLAUDE.md — Portfolio Growth OS (threads-uploader)

## Tooling
- 이 저장소는 Claude Code만 쓴다. orchestrator·oh-my-agent·Codex·Gemini·Qwen 설정(`AGENTS.md`, `GEMINI.md`, `.codex/`, `.gemini/`, `.qwen/`, `.omo/`, oma 훅)을 다시 만들지 않는다.
- `.agents/memory/`는 에이전트 설정이 아니라 앱과 스크립트가 읽는 데이터다(`brand-voice.md`, `task_board.md`). 지우지 않는다.
- 패키지 매니저는 폴더마다 다르다. 전역 pnpm 규칙보다 이 설정이 우선한다.
  - 루트 앱: npm(`package-lock.json`). Vercel도 이 lockfile로 npm 설치한다. 루트에서 `pnpm`/`yarn`을 실행하지 않는다.
  - `video/`(Remotion 컴포지터): pnpm(`video/pnpm-lock.yaml`). GitHub 워크플로가 이 폴더에서 `pnpm install`한다.

## Verify
- `npm run typecheck`
- `npm test`

## Communication
- 보고/요약은 한국어로 작성한다.
