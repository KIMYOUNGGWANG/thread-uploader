---
name: performance-optimizer
description: Next.js/Supabase 애플리케이션 성능 최적화 가이드. DB 인덱스 및 쿼리 최적화, Server Components 활용, 번들 최적화, 이미지 최적화, 캐싱 전략. 성능 이슈 진단, 느린 쿼리 분석, Core Web Vitals 개선 시 사용.
risk: safe
---

# 🏎️ Performance Optimizer

Production-grade performance patterns for Next.js + Supabase applications.

## Database Performance

### Query Optimization

```sql
-- EXPLAIN ANALYZE로 느린 쿼리 분석
EXPLAIN ANALYZE SELECT * FROM posts WHERE user_id = $1 ORDER BY created_at DESC;

-- 인덱스 추가 (FK + 자주 쿼리되는 컬럼)
CREATE INDEX idx_posts_user_id ON posts(user_id);
CREATE INDEX idx_posts_created_at ON posts(created_at DESC);
CREATE INDEX idx_posts_user_created ON posts(user_id, created_at DESC);

-- 부분 인덱스 (조건 필터링 최적화)
CREATE INDEX idx_posts_published ON posts(created_at DESC) WHERE published = true;
```

### Supabase Connection Pooling

```typescript
// 서버리스 환경에서는 Supabase가 PgBouncer를 통한 풀링 제공
// Transaction mode 사용 시 세션 수준 기능 불가 (prepared statements 등)

// 대량 데이터 조회 시 페이지네이션 필수
const { data } = await supabase
  .from('posts')
  .select('id, title, created_at')  // 필요한 컬럼만 선택
  .range(0, 19)                      // 20개씩 페이지네이션
  .order('created_at', { ascending: false })
```

### N+1 쿼리 방지

```typescript
// ❌ N+1 쿼리 (댓글마다 유저 조회)
const posts = await supabase.from('posts').select('*')
for (const post of posts.data) {
  const user = await supabase.from('users').select('*').eq('id', post.user_id)
}

// ✅ JOIN으로 한 번에 조회
const { data } = await supabase
  .from('posts')
  .select(`
    id, title, content, created_at,
    users (id, name, avatar_url),
    comments (count)
  `)
```

## Frontend Performance

### Server Components 우선 전략

```typescript
// ✅ Server Component - 번들에 포함되지 않음
// app/posts/page.tsx
export default async function PostsPage() {
  const posts = await getPosts()  // 서버에서 직접 DB 조회
  return <PostList posts={posts} />
}

// Client Component는 인터랙션이 필요한 경우만
// components/features/PostList.tsx
'use client'
export function PostList({ posts }: { posts: Post[] }) {
  const [filter, setFilter] = useState('all')
  // ...
}
```

### 이미지 최적화

```typescript
import Image from 'next/image'

// ✅ next/image 사용 (WebP 변환, lazy loading, CLS 방지)
<Image
  src={post.coverUrl}
  alt={post.title}
  width={800}
  height={450}
  priority={isAboveFold}   // LCP 이미지에만 사용
  placeholder="blur"
  blurDataURL={post.blurHash}
/>

// ❌ 일반 img 태그 (CLS 발생, 최적화 없음)
<img src={post.coverUrl} alt={post.title} />
```

### 번들 최적화

```typescript
// ✅ 직접 import (tree-shaking)
import { Button } from '@/components/ui/button'
import { ChevronRight } from 'lucide-react'

// ❌ barrel import (전체 번들 포함)
import { Button } from '@/components/ui'
import * as Icons from 'lucide-react'

// 무거운 컴포넌트 dynamic import
const RichEditor = dynamic(() => import('@/components/RichEditor'), {
  ssr: false,
  loading: () => <EditorSkeleton />
})
```

### TanStack Query 캐싱 전략

```typescript
// staleTime: 데이터가 fresh로 간주되는 시간 (기본값: 0)
// gcTime: 캐시에서 제거되기까지 시간 (기본값: 5분)

const { data } = useQuery({
  queryKey: ['posts', filter],
  queryFn: () => fetchPosts(filter),
  staleTime: 60 * 1000,        // 1분간 fresh (네트워크 요청 없음)
  gcTime: 5 * 60 * 1000,       // 5분간 캐시 유지
})

// Prefetch로 다음 페이지 미리 로드
const queryClient = useQueryClient()
const prefetchNextPage = () => {
  queryClient.prefetchQuery({
    queryKey: ['posts', { page: currentPage + 1 }],
    queryFn: () => fetchPosts({ page: currentPage + 1 }),
  })
}
```

## API 성능

### HTTP 캐시 헤더

```typescript
// app/api/posts/route.ts
export async function GET() {
  const posts = await getPosts()

  return Response.json(posts, {
    headers: {
      'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
    },
  })
}

// 정적 데이터는 Next.js 내장 캐싱 활용
export const revalidate = 3600  // 1시간마다 재검증
```

### Zod 런타임 검증 최적화

```typescript
// 스키마 한 번 정의 후 재사용 (parse 비용 최소화)
export const PostSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1),
})

// safeParse로 예외 없이 검증
const result = PostSchema.safeParse(body)
if (!result.success) {
  return Response.json({ error: result.error.flatten() }, { status: 400 })
}
```

## Core Web Vitals 체크리스트

- [ ] **LCP < 2.5s**: 히어로 이미지에 `priority` 추가, 서버 응답 < 200ms
- [ ] **CLS < 0.1**: 이미지에 `width`/`height` 명시, 폰트 `font-display: swap`
- [ ] **INP < 200ms**: 무거운 이벤트 핸들러를 `useTransition`으로 분리
- [ ] **TTFB < 800ms**: Supabase 리전을 사용자 지역에 맞게 설정
- [ ] 번들 크기: `next build` 후 `.next/analyze` 검토 (next-bundle-analyzer)
- [ ] DB 쿼리: 모든 FK에 인덱스, EXPLAIN ANALYZE로 느린 쿼리 확인
- [ ] 이미지: `next/image` 사용, lazy loading 확인
- [ ] 폰트: `next/font` 사용, 서브셋 로드

## Measurement Workflow

1. `next build` 또는 실제 배포 build 결과를 본다.
2. 느린 화면에서 API / DB / render / bundle 중 어디가 병목인지 나눈다.
3. 하나씩 바꾸고 다시 측정한다.
4. 성능 개선은 숫자로 남긴다.

## Quick Diagnostics

```bash
# 느린 쿼리 후보
rg -n "select\\(|from\\(" src lib

# 큰 클라이언트 번들 후보
rg -n "'use client'|use client" app src
```

## Review Checklist

- [ ] 병목이 DB, network, render, bundle 중 어디인지 밝혔는가?
- [ ] Core Web Vitals 목표 수치가 있는가?
- [ ] 개선 전후 수치 비교가 있는가?
- [ ] 추측성 useMemo/useCallback 남발 없이 근거 있는 최적화인가?
