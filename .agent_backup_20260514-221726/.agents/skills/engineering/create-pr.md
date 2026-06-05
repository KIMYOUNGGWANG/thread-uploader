---
name: create-pr
description: PR 생성 및 문서화 기준. What/Why 구조, 스크린샷 첨부, breaking change 기록, 체크리스트, gh CLI 명령어. PR 작성, 코드 리뷰 준비, 브랜치 작업 완료 후 사용.
risk: safe
---

# 📝 PR Generator & Documentation

Standards for high-quality pull requests that reviewers love.

## PR Description Template

```markdown
## What

[1-3 bullet points describing WHAT changed]
- Add user authentication with Supabase Auth
- Implement protected route middleware
- Add login/signup page with form validation

## Why

[1-2 sentences explaining WHY this change is needed]
Users need to authenticate before accessing personal data. This unblocks Phase 2 of the roadmap.

## Changes

- `src/middleware.ts` — route protection logic
- `src/app/(auth)/login/page.tsx` — login UI
- `src/services/auth.ts` — Supabase auth helpers

## Screenshots

| Before | After |
|--------|-------|
| ![before](url) | ![after](url) |

## Breaking Changes

- ❌ None
<!-- OR -->
- `getUser()` return type changed: `User | null` → `User` (throws on missing session)

## Testing

- [ ] `pnpm typecheck` — no errors
- [ ] `pnpm lint` — no warnings
- [ ] `pnpm test` — all tests pass
- [ ] Manual: login flow tested in dev
- [ ] Manual: protected routes redirect when unauthenticated
```

## gh CLI 명령어

```bash
# PR 생성
gh pr create \
  --title "feat: add Supabase authentication" \
  --body "$(cat <<'EOF'
## What
- Add Supabase Auth with email/password

## Why
Users need authentication before Phase 2.
EOF
)"

# 드래프트 PR (WIP)
gh pr create --draft --title "WIP: feat/auth"

# PR 상태 확인
gh pr status

# PR 머지 (squash)
gh pr merge --squash --delete-branch

# 리뷰 요청
gh pr edit --add-reviewer team-member
```

## Commit Message Convention

```
<type>(<scope>): <description>

Types: feat | fix | refactor | docs | test | chore | style | perf
Scope: auth | ui | api | db | config (optional)

Examples:
feat(auth): add Google OAuth login
fix(api): resolve CORS error on /posts endpoint
refactor(ui): extract Card component from Dashboard
perf(db): add index on posts.user_id for faster queries
docs: update deployment guide with Vercel env vars
```

## 브랜치 전략

```
main        ← production (PR만, 직접 push 금지)
  └── feature/auth-supabase   ← 기능 개발
  └── fix/cors-issue           ← 버그 수정
  └── hotfix/critical-bug      ← 긴급 수정 (main으로 직접)
```

## 체크리스트 (PR 생성 전)

### 코드 품질
- [ ] `pnpm typecheck` — TypeScript 에러 없음
- [ ] `pnpm lint` — ESLint 경고/에러 없음
- [ ] `pnpm test` — 모든 테스트 통과
- [ ] 새로운 `any` 타입 없음
- [ ] console.log 제거

### 보안
- [ ] 하드코딩된 secrets/API keys 없음
- [ ] `.env` 파일 커밋되지 않음
- [ ] 클라이언트에서 service role key 사용 안 함

### 기능
- [ ] loading, error, empty 상태 모두 처리
- [ ] UI 변경 시 스크린샷 첨부
- [ ] Breaking change 명시

### 문서
- [ ] 관련 문서 업데이트
- [ ] 복잡한 로직에 주석 추가

## Anti-Patterns

- ❌ "Fix bug", "Update code" 같은 모호한 제목
- ❌ 1000줄 이상 PR (작게 나눠서 리뷰하기 쉽게)
- ❌ 스크린샷 없는 UI 변경
- ❌ 테스트 없는 기능 추가
- ❌ main에 직접 push

## Review-Friendly Size Guide

| PR 크기 | 판단 |
|--------|------|
| < 300 lines | ideal |
| 300-700 lines | acceptable if cohesive |
| 700+ lines | split strongly recommended |

## Final Checklist

- [ ] 제목이 `type(scope): summary` 형식인가?
- [ ] What / Why / Testing 이 빠지지 않았는가?
- [ ] reviewer 가 실제로 확인해야 할 risk 가 적혀 있는가?
- [ ] UI 변경이면 before/after 가 있는가?
