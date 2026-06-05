---
name: claude-token-optimization
description: "Claude Code CLI 토큰 효율 최적화 전략. CLAUDE.md 레이어링, Bridge 계층 분리, on-demand 스킬 로딩, 세션 내 작업 패턴."
---

# 🎯 Claude Code CLI — 토큰 효율 최적화

> **핵심 원칙**: Claude가 자동으로 읽는 것(CLAUDE.md)에 규칙을 넣고, Bridge에는 태스크 컨텍스트만 전달한다.

## 1. 3-Layer Context Architecture

```
Layer 1 — CLAUDE.md (자동 로딩, 토큰 0 소비)
├── 스택 정의, 핵심 규칙, 컨벤션
├── 스킬 참조 경로 (.claude/skills/)
└── 절대 변하지 않는 것들

Layer 2 — Commands (슬래시 커맨드 실행 시 로딩)
├── 워크플로우 지시 (develop, plan, fix 등)
├── on-demand 스킬 로딩 트리거
└── 태스크별 파일 읽기 순서

Layer 3 — Bridge (수동 붙여넣기, 최대 토큰 소비)
├── task_board.md (현재 미션)
├── api-spec.md (계약)
├── learnings.md (과거 실수)
└── 동적 로딩된 스킬
```

### Layer 우선순위 규칙
| 상황 | 사용할 Layer | 예상 토큰 |
|:---|:---|:---:|
| 간단한 코드 수정 | Layer 1만 (CLAUDE.md) | ~300 |
| 기능 구현 (/develop) | Layer 1 + Layer 2 (Command) | ~1,500 |
| 복잡한 프로젝트 작업 | Layer 1 + Layer 3 (Bridge) | ~4,000 |

## 2. CLAUDE.md 최적화 원칙

### ✅ 넣어야 할 것
- 스택 정의 (1줄)
- 핵심 규칙 (5줄 이내, 체크리스트형)
- 스킬 참조 경로 (읽기 지시)
- api-spec 참조 (읽기 지시)

### ❌ 넣지 말아야 할 것
- 스킬 전문 (파일 참조로 대체)
- 워크플로우 규칙 (commands에서 처리)
- 과거 히스토리 (learnings.md로 분리)

### 템플릿
```markdown
# CLAUDE.md
## Stack: Next.js 16+ | TypeScript | Supabase | Tailwind | Shadcn | Zustand | TanStack Query
## Rules
- pnpm only. any 금지. Zod 검증 필수. RSC default
- 함수 < 20줄. SRP. 축약어 금지 (req→request)
- 코드 전 관련 파일 읽기. 완료 전 `pnpm typecheck && pnpm lint`
## Skills: `.claude/skills/` (필요 시 on-demand로 읽기)
## Contract: `docs/api-spec.md` (모든 구현의 기준)
## Memory: `.agent/memory/task_board.md` (현재 미션), `.agent/memory/learnings.md` (과거 실수)
```

## 3. 세션 내 토큰 절약 패턴

### ✅ 최적 패턴
```
1. /develop 입력 → Claude가 CLAUDE.md 자동 읽음
2. commands/develop.md 실행 → task_board, api-spec 읽기
3. 필요 시 skill-loader 1회 호출 → 관련 스킬만 로딩
4. 코딩 수행
5. pnpm typecheck && pnpm lint 실행
```

### ❌ 안티패턴
```
❌ Bridge 내용 붙여넣기 + "이 파일도 읽어줘" (중복 토큰)
❌ 모든 스킬을 한 번에 로딩 (불필요한 토큰)
❌ 이전 대화 내용 반복 요약 요청 (문맥 낭비)
❌ 긴 코드 블록을 메시지에 포함 (파일 경로로 대체)
```

## 4. Bridge --slim 모드

대부분의 작업에서 `--slim` 모드 사용 권장:

| 모드 | 포함 내용 | 예상 크기 |
|:---|:---|:---:|
| `full` (기본) | task_board + api-spec 전체 + learnings 전체 + skills | ~15KB |
| `--slim` | task_board + api-spec 요약 + learnings 최근 5개 | ~5KB |
| `--micro` | task_board의 현재 스텝만 | ~1KB |

## 5. 파일 참조 vs 내용 포함

| 상황 | 방법 | 이유 |
|:---|:---|:---|
| Claude Code CLI 사용 | 파일 경로 참조 | Claude가 자체적으로 파일 읽기 가능 |
| Codex에 직접 붙여넣기 | 내용 포함 (Bridge) | Codex는 파일 접근 불가 |
| API spec 참조 | `docs/api-spec.md 읽어` | 매번 스펙 전문을 포함하면 토큰 낭비 |

## 실행 체크리스트

- [ ] CLAUDE.md가 10줄 이내인가?
- [ ] 스킬은 파일 경로 참조로만 언급하는가?
- [ ] Bridge는 태스크 컨텍스트만 포함하는가?
- [ ] 동일 정보가 CLAUDE.md와 Bridge에 중복되지 않는가?
- [ ] 스킬 로딩은 on-demand인가? (all-at-once가 아닌가?)
