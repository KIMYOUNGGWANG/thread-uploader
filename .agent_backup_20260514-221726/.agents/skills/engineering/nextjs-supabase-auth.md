---
name: nextjs-supabase-auth
description: Next.js 14+ App Router + Supabase Auth 구현 가이드. @supabase/ssr 기반 Server Component, Route Handler, Middleware 패턴. 인증 구현, 세션 관리, RLS 보호 라우트 작업 시 사용.
---

# 🔐 Next.js + Supabase Authentication

Next.js 14+ App Router와 `@supabase/ssr` 기반 인증 구현 가이드.

## 1. 클라이언트 생성 패턴

### Server Components / Server Actions
```typescript
// lib/supabase/server.ts
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        },
      },
    }
  );
}
```

### Client Components
```typescript
// lib/supabase/client.ts
import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

## 2. Middleware — 라우트 보호

```typescript
// middleware.ts
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            supabaseResponse.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  // 비인증 사용자 → 로그인 페이지로
  if (!user && !request.nextUrl.pathname.startsWith('/login')) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: ['/dashboard/:path*', '/api/private/:path*'],
};
```

## 3. Server Action — 로그인/로그아웃

```typescript
// server/auth.ts
'use server';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export async function signIn(formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  });
  if (error) return { error: error.message };
  redirect('/dashboard');
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}
```

## 4. Server Component — 유저 데이터 접근

```typescript
// app/dashboard/page.tsx
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  return <div>{profile?.display_name}</div>;
}
```

## 5. Rules

1. **항상 `getUser()` 사용** — `getSession()`은 서버에서 신뢰 불가 (JWT만 검증, DB 확인 안 함).
2. **RLS 항상 ON** — 클라이언트에서 service role key 사용 절대 금지.
3. **에러 항상 처리** — `const { data, error } = await supabase...` 패턴 준수.
4. **쿠키 동기화** — middleware에서 `supabaseResponse` 반드시 반환 (세션 갱신용).

## 6. Anti-Patterns

- ❌ `createRouteHandlerClient`, `createServerComponentClient` — 구버전 deprecated
- ❌ 클라이언트에서 `SUPABASE_SERVICE_ROLE_KEY` 사용
- ❌ `getSession()` 서버사이드 사용 (신뢰 불가)
- ❌ RLS 없이 테이블 직접 접근
