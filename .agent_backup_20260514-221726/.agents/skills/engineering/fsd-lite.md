---
name: fsd-lite
description: Feature-Sliced Design Lite — AI-driven 프로젝트를 위한 간소화된 폴더 구조 설계. src/features, src/components, src/hooks, src/lib 패턴. 새 기능 추가, 폴더 구조 설계, 리팩터링 시 사용.
---

# 🏗️ FSD-Lite (Feature-Sliced Design Lite)

A simplified version of Feature-Sliced Design for AI-driven development.

## 1. Directory Structure

```
src/
├── app/                    # Next.js App Router (pages, layouts, loading, error)
│   ├── (auth)/             # Route groups for layout grouping
│   ├── (dashboard)/
│   └── api/                # API routes
├── components/
│   ├── ui/                 # Shadcn/UI primitives — 직접 수정 금지
│   └── shared/             # 재사용 가능한 공통 컴포넌트
├── features/               # 기능별 비즈니스 로직 + 컴포넌트
│   ├── auth/               # index.ts + components/ + hooks/ + types.ts
│   ├── dreams/             # index.ts + components/ + hooks/ + types.ts
│   └── wormhole/           # index.ts + components/ + hooks/ + types.ts
├── hooks/                  # 공유 React 훅
├── lib/                    # 외부 라이브러리 초기화 (supabase, stripe 등)
├── store/                  # Zustand 스토어 (도메인별 1파일)
├── types/                  # 전역 TypeScript 타입
└── utils/                  # 순수 유틸리티 함수
```

## 2. Feature 폴더 구조

각 `features/<name>/` 폴더는 다음을 포함:

```
features/dreams/
├── index.ts              # Public API — 외부에 노출할 것만 export
├── types.ts              # 이 기능의 TypeScript 타입
├── hooks/
│   ├── useDreams.ts      # 데이터 페칭 (TanStack Query)
│   └── useDreamForm.ts   # 폼 상태 관리
├── components/
│   ├── DreamCard.tsx
│   ├── DreamForm.tsx
│   └── DreamList.tsx
└── api.ts                # Server Actions 또는 API 호출 함수
```

## 3. Core Rules

1. **단방향 의존성**: `shared` → `features` 방향만 허용. `features` → `shared` 역방향 금지.
2. **Feature 격리**: Feature 간 직접 import 금지. 필요하면 `shared`로 올리기.
3. **Public API**: 각 feature는 `index.ts`로만 외부에 노출.
4. **공유 기준**: 2개 이상의 feature에서 쓰이면 `shared`로 이동.

## 4. Import Rules

```typescript
// ✅ 올바른 import
import { DreamCard } from '@/features/dreams';
import { Button } from '@/components/ui/button';
import { formatDate } from '@/utils/date';

// ❌ 금지 — feature 내부 직접 접근
import { DreamCard } from '@/features/dreams/components/DreamCard';

// ❌ 금지 — feature 간 직접 의존
import { useAuth } from '@/features/auth/hooks/useAuth'; // (dreams feature 안에서)
```

## 5. When to Use Each Layer

| 레이어 | 사용 시점 |
|--------|----------|
| `app/` | 라우팅, 레이아웃, 페이지 조합 |
| `features/` | 특정 도메인 비즈니스 로직 |
| `components/shared/` | 2개+ feature에서 재사용되는 UI |
| `components/ui/` | Shadcn 프리미티브 (수정 금지) |
| `hooks/` | 도메인 무관 공유 훅 |
| `lib/` | 외부 서비스 클라이언트 초기화 |
| `store/` | 전역 UI 상태 (Zustand) |
| `types/` | 여러 feature에 걸친 공통 타입 |
| `utils/` | 순수 함수, 포맷터, 헬퍼 |

## 6. Move Decision Table

| 신호 | 이동 위치 |
|------|----------|
| 한 feature 안에서만 쓰는 hook | `features/<name>/hooks/` |
| 두 feature 이상이 공유하는 UI | `components/shared/` |
| 외부 SDK 초기화 코드 | `lib/` |
| 브라우저 전역 UI 상태 | `store/` |

## 7. Violation Examples

```typescript
// ❌ feature 내부 구현을 직접 import
import { DreamForm } from '@/features/dreams/components/DreamForm';

// ✅ public API 로만 import
import { DreamForm } from '@/features/dreams';
```

## 8. Review Checklist

- [ ] feature 간 직접 의존이 없는가?
- [ ] 공유로 올릴 기준이 `두 번 이상 재사용`으로 일관적인가?
- [ ] route 전용 코드가 `app/` 밖으로 새고 있지 않은가?
