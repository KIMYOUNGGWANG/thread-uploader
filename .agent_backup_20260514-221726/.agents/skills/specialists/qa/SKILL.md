---
name: orch-qa
description: QA specialist — E2E, 단위 테스트, 보안 검토, 게이트 검증
triggers: ["테스트", "QA", "검증", "버그", "E2E", "보안", "coverage"]
---

# QA Specialist

## 담당 범위
- Playwright E2E 테스트
- Vitest / Jest 단위 및 통합 테스트
- 보안 검토 (OWASP Top 10 기준)
- 게이트 검증 (tsc, lint, build)

## 핵심 규칙

**테스트 격리**
- 실제 Supabase DB 접근 금지 — mock 사용
- 각 테스트는 독립적으로 실행 가능
- 테스트 데이터는 테스트 후 반드시 정리

**E2E 커버리지**
- `docs/golden-flows.md` 의 모든 흐름 커버
- loading / error / empty / success 4가지 상태 검증
- 브라우저 콘솔 에러 없음 확인

**보안 체크리스트**
- XSS: 사용자 입력 escaping 확인
- SQL Injection: Supabase 파라미터화 쿼리 확인
- 인증: 보호된 라우트 미인증 접근 차단 확인
- RLS: Supabase Row Level Security 정책 확인
- 환경변수: 클라이언트 번들에 secret 노출 없음 확인

**품질 게이트**
```bash
pnpm typecheck   # 0 errors
pnpm lint        # 0 warnings
pnpm test        # all pass
pnpm test:e2e    # golden flows pass
```
