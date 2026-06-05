---
name: supabase-rls-patterns
description: "Supabase Row Level Security(RLS) 실전 패턴. 정책 설계, 유저 격리, 역할 기반 접근, 일반적 실수 방지."
---

# 🔐 Supabase RLS Patterns

> **핵심 원칙**: RLS가 없으면 모든 데이터가 공개 상태. 테이블 생성 즉시 RLS를 활성화하라.

## 1. RLS 기본 규칙

```sql
-- ✅ 테이블 생성 즉시 RLS 활성화
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ⚠️ RLS 활성화만으론 불충분 → 정책 없으면 모든 접근 차단
-- 반드시 정책(Policy)을 추가해야 함
```

## 2. 핵심 정책 패턴

### Pattern 1: 자신의 데이터만 접근 (User Isolation)
```sql
-- 읽기: 자신의 프로필만 조회
CREATE POLICY "Users can read own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = user_id);

-- 쓰기: 자신의 프로필만 수정
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 삽입: 자신의 데이터만 생성
CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);
```

### Pattern 2: 공개 읽기 + 소유자 수정 (Public Read)
```sql
-- 모든 사용자 읽기 가능 (공개 콘텐츠)
CREATE POLICY "Anyone can read posts"
  ON public.posts FOR SELECT
  USING (published = true);

-- 소유자만 수정 가능
CREATE POLICY "Authors can update own posts"
  ON public.posts FOR UPDATE
  USING (auth.uid() = author_id);
```

### Pattern 3: 역할 기반 접근 (Role-Based)
```sql
-- Admin만 삭제 가능
CREATE POLICY "Admins can delete any post"
  ON public.posts FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );
```

### Pattern 4: 관계 기반 접근 (Relationship-Based)
```sql
-- 팀 멤버만 팀 데이터 접근
CREATE POLICY "Team members can read team data"
  ON public.team_data FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.team_members
      WHERE team_members.team_id = team_data.team_id
      AND team_members.user_id = auth.uid()
    )
  );
```

## 3. 결제/구독 관련 RLS

```sql
-- 유료 사용자만 프리미엄 콘텐츠 접근
CREATE POLICY "Premium users can read premium content"
  ON public.premium_content FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.subscriptions
      WHERE subscriptions.user_id = auth.uid()
      AND subscriptions.status = 'active'
      AND subscriptions.plan IN ('pro', 'enterprise')
    )
  );
```

## 4. ⚠️ 일반적 실수 & 해결

### ❌ 실수 1: `auth.uid()` 대신 `current_user` 사용
```sql
-- ❌ PostgreSQL 기본 함수 — Supabase Auth와 무관
USING (current_user = user_id);

-- ✅ Supabase Auth의 JWT에서 추출
USING (auth.uid() = user_id);
```

### ❌ 실수 2: Service Role Key 클라이언트 노출
```typescript
// ❌ 절대 금지 — RLS 우회
const supabase = createClient(url, SERVICE_ROLE_KEY);

// ✅ 클라이언트에서는 반드시 anon key
const supabase = createClient(url, ANON_KEY);
```

### ❌ 실수 3: INSERT 시 WITH CHECK 누락
```sql
-- ❌ USING만 있으면 INSERT에 적용 안 됨
CREATE POLICY "..." ON ... FOR INSERT USING (...);

-- ✅ INSERT는 반드시 WITH CHECK 사용
CREATE POLICY "..." ON ... FOR INSERT WITH CHECK (...);
```

### ❌ 실수 4: RLS 정책 없이 테이블 사용
```sql
-- RLS 활성화 후 정책 없으면 → 모든 접근 차단 (데이터 안 보임)
-- 반드시 최소 1개 SELECT 정책 추가
```

### ❌ 실수 5: Server Component에서 RLS 우회
```typescript
// ❌ Server Component에서 service role 사용
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(url, process.env.SERVICE_ROLE_KEY!);

// ✅ Server Component에서도 사용자 세션 기반 클라이언트
import { createServerClient } from '@supabase/ssr';
const supabase = createServerClient(url, anonKey, { cookies });
```

## 5. 마이그레이션 체크리스트

새 테이블 생성 시 반드시:
- [ ] `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;`
- [ ] SELECT 정책 추가 (누가 읽을 수 있는가?)
- [ ] INSERT 정책 추가 + `WITH CHECK` (누가 생성할 수 있는가?)
- [ ] UPDATE 정책 추가 + `USING` + `WITH CHECK` (누가 수정할 수 있는가?)
- [ ] DELETE 정책 추가 (누가 삭제할 수 있는가?)
- [ ] Service Role Key가 클라이언트에 노출되지 않는가?
- [ ] Supabase Dashboard에서 정책 테스트 완료

## Related Skills

- `nextjs-supabase-auth.md` — Auth + 미들웨어 패턴
- `supabase-automation.md` — Supabase 전반 자동화
- `coding-standards.md` — Section 4: Security & Validation
