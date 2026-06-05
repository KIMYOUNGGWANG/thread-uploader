---
name: error-boundary-patterns
description: "React Error Boundary + Suspense 실전 패턴. Next.js App Router의 error.tsx/loading.tsx/not-found.tsx 활용, 에러 복구 전략."
---

# 🛡️ Error Boundary Patterns — Next.js App Router

> **원칙**: 에러는 숨기지 말고 우아하게 처리한다. 사용자에게 명확한 피드백과 복구 방법을 제공한다.

## 1. Next.js 파일 기반 Error Boundary

### 기본 구조
```
app/
├── layout.tsx
├── error.tsx           ← 전역 에러 경계
├── loading.tsx         ← 전역 로딩 상태
├── not-found.tsx       ← 404 처리
├── dashboard/
│   ├── page.tsx
│   ├── error.tsx       ← 대시보드 전용 에러 경계
│   └── loading.tsx     ← 대시보드 전용 로딩
└── settings/
    ├── page.tsx
    └── error.tsx       ← 설정 전용 에러 경계
```

### error.tsx 템플릿
```typescript
'use client';

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center gap-4">
      <div className="rounded-xl bg-red-50 dark:bg-red-900/20 p-8 text-center">
        <h2 className="text-lg font-semibold text-red-800 dark:text-red-200">
          문제가 발생했습니다
        </h2>
        <p className="mt-2 text-sm text-red-600 dark:text-red-300">
          {error.message || '잠시 후 다시 시도해주세요.'}
        </p>
        <button
          onClick={reset}
          className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white 
                     transition-all duration-300 hover:bg-red-700 hover:scale-[1.02]"
        >
          다시 시도
        </button>
      </div>
    </div>
  );
}
```

### loading.tsx 템플릿
```typescript
export default function Loading() {
  return (
    <div className="flex min-h-[400px] items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-600 
                        border-t-transparent" />
        <p className="text-sm text-slate-500">로딩 중...</p>
      </div>
    </div>
  );
}
```

## 2. Suspense 경계 전략

### 컴포넌트별 Suspense (권장)
```typescript
import { Suspense } from 'react';

export default function DashboardPage() {
  return (
    <div className="grid grid-cols-2 gap-6">
      {/* 각 섹션이 독립적으로 로딩 */}
      <Suspense fallback={<CardSkeleton />}>
        <RevenueChart />
      </Suspense>
      
      <Suspense fallback={<CardSkeleton />}>
        <UserStats />
      </Suspense>
      
      <Suspense fallback={<TableSkeleton />}>
        <RecentTransactions />
      </Suspense>
    </div>
  );
}
```

> 💡 **핵심**: 전체 페이지가 아니라 **섹션별로** Suspense를 걸면, 하나가 느려도 나머지는 즉시 보인다.

## 3. API 에러 처리 패턴

### Server Action 에러 처리
```typescript
'use server';

import { z } from 'zod';

const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2),
});

export async function createUser(formData: FormData) {
  // 1. 입력 검증
  const parsed = createUserSchema.safeParse({
    email: formData.get('email'),
    name: formData.get('name'),
  });
  
  if (!parsed.success) {
    return { error: '입력값을 확인해주세요.', details: parsed.error.flatten() };
  }
  
  // 2. DB 작업 (try-catch 필수)
  try {
    const { data, error } = await supabase
      .from('users')
      .insert(parsed.data)
      .select()
      .single();
    
    if (error) throw error;
    
    return { success: true, user: data };
  } catch (error) {
    // 3. 에러 로깅 (내부 상세는 숨김)
    console.error('User creation failed:', error);
    return { error: '사용자 생성에 실패했습니다. 잠시 후 다시 시도해주세요.' };
  }
}
```

### TanStack Query 에러 처리
```typescript
const { data, error, isError } = useQuery({
  queryKey: ['user', userId],
  queryFn: () => fetchUser(userId),
  retry: 2,
  retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
});

if (isError) {
  return <ErrorMessage message={error.message} />;
}
```

## 4. Toast 알림 패턴

```typescript
import { toast } from 'sonner'; // or react-hot-toast

// 성공
toast.success('저장되었습니다');

// 에러 (사용자 친화적 메시지)
toast.error('저장에 실패했습니다. 잠시 후 다시 시도해주세요.');

// Promise 기반 (자동 로딩/성공/에러)
toast.promise(saveSettings(data), {
  loading: '저장 중...',
  success: '설정이 저장되었습니다',
  error: '설정 저장에 실패했습니다',
});
```

## 5. 에러 계층 규칙

| 에러 유형 | 처리 위치 | 사용자 피드백 |
|:---|:---|:---|
| 입력 검증 실패 | 폼/컴포넌트 | 인라인 에러 메시지 |
| API 요청 실패 | TanStack Query / Server Action | Toast + retry 버튼 |
| 인증 만료 | Middleware | 로그인 페이지 리다이렉트 |
| 404 | not-found.tsx | "페이지를 찾을 수 없습니다" |
| 서버 에러 (500) | error.tsx | "문제가 발생했습니다" + reset 버튼 |
| 치명적 에러 | global-error.tsx | 전체 페이지 에러 UI |

## 실행 체크리스트

- [ ] 각 route segment에 `error.tsx` 있는가?
- [ ] 데이터 fetching 컴포넌트에 `<Suspense>` 경계가 있는가?
- [ ] 모든 API 호출이 `try-catch`로 감싸져 있는가?
- [ ] 사용자에게 내부 에러 상세가 노출되지 않는가?
- [ ] Toast로 사용자 피드백을 제공하는가?
- [ ] 에러 발생 시 복구 방법(retry 버튼, 리다이렉트)이 있는가?

## Recovery Matrix

| 실패 위치 | 복구 수단 | UI |
|----------|----------|----|
| 폼 검증 | 필드 수정 후 재제출 | inline error |
| 서버 액션 | retry / toast | section-level feedback |
| route segment | `reset()` | `error.tsx` fallback |
| 존재하지 않는 문서 | 홈/리스트 이동 | `not-found.tsx` |

## Anti-Patterns

- 하나의 전역 error boundary 로 모든 문제를 처리한다.
- retry 버튼이 있지만 동일한 invalid input 을 그대로 재전송한다.
- 에러 메시지와 복구 액션이 분리되어 있다.
