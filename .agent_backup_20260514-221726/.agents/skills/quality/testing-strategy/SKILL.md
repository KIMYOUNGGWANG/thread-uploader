---
name: testing-strategy
description: "Use when writing tests, setting up test infrastructure, or reviewing test coverage. Vitest + Playwright patterns for Golden Stack (Next.js/Supabase). Unit, Integration, and E2E test templates."
user-invocable: true
allowed-tools: ["Bash", "Read", "Write"]
---

# 🧪 Testing Strategy — Golden Stack Edition

> **원칙**: 100% 커버리지가 아니라 **높은 신뢰도**가 목표.

## Testing Pyramid

```
         ╱╲
        ╱ E2E ╲         ← 적게 (핵심 사용자 플로우만)
       ╱────────╲
      ╱ Integration ╲    ← 중간 (API + DB 연동)
     ╱────────────────╲
    ╱    Unit Tests     ╲  ← 많이 (비즈니스 로직)
   ╱──────────────────────╲
```

| Level | Tool | Target | Coverage Goal |
|:---|:---|:---|:---:|
| Unit | **Vitest** | Utils, hooks, store logic | 80%+ |
| Integration | **Vitest + MSW** | API routes, Supabase queries | Critical paths 100% |
| E2E | **Playwright** | User flows (signup→payment) | Top 5~10 |

## Classification Rules

| Code Type | Test Type | Required? |
|:---|:---|:---:|
| Pure util functions | Unit | ✅ Required |
| Zustand Store | Unit | ✅ Required |
| Custom Hook | Unit + Integration | ✅ Required |
| API Route | Integration | ✅ Required |
| UI Component | Snapshot | 🟡 Recommended |
| User Flow | E2E | ✅ Critical only |

## Resources in This Skill

- `references/test-patterns.md` — Code templates for Unit, Integration, E2E tests
- `scripts/coverage-check.sh` — Quick test coverage report

## Execution Checklist

- [ ] 비즈니스 로직에 Unit 테스트 있는가?
- [ ] API 라우트에 Integration 테스트 있는가?
- [ ] 핵심 플로우 E2E 테스트 있는가?
- [ ] 에러 케이스 (400, 401, 500) 테스트되는가?
- [ ] `pnpm test`로 즉시 실행 가능한가?
