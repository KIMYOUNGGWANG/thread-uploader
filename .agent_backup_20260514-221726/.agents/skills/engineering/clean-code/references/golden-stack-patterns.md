# Golden Stack Patterns — Next.js + Supabase + Zustand

## Naming Conventions (Project-Specific)

| Category | Convention | Example |
|----------|-----------|---------|
| Components | PascalCase | `DreamCard.tsx` |
| Hooks | camelCase with `use` | `useDreamList.ts` |
| Utils | camelCase | `formatDreamDate.ts` |
| Types | PascalCase with suffix | `DreamResponse`, `CreateDreamInput` |
| API routes | kebab-case dirs | `app/api/dreams/route.ts` |
| Zustand stores | camelCase with `use...Store` | `useDreamStore.ts` |

## Server vs Client Components

```
Default: Server Component (RSC)
"use client" ONLY when:
  - useState, useEffect, useRef needed
  - Event handlers (onClick, onChange)
  - Browser APIs (window, document)
  - Zustand store access
```

## Zustand Pattern

```typescript
// ✅ Good: Selectors for render optimization
const dreams = useDreamStore((state) => state.dreams);
const addDream = useDreamStore((state) => state.addDream);

// ❌ Bad: Destructuring causes unnecessary re-renders
const { dreams, addDream } = useDreamStore();
```

## TanStack Query Pattern

```typescript
// ✅ Good: Query key factory
const dreamKeys = {
  all: ['dreams'] as const,
  lists: () => [...dreamKeys.all, 'list'] as const,
  detail: (id: string) => [...dreamKeys.all, 'detail', id] as const,
};
```

## Zod Validation (Required for all inputs)

```typescript
// ✅ Always validate at boundaries
const CreateDreamSchema = z.object({
  title: z.string().min(1).max(100),
  content: z.string().min(1),
  isPublic: z.boolean().default(false),
});

type CreateDreamInput = z.infer<typeof CreateDreamSchema>;
```

## Error Handling Pattern

```typescript
// ✅ Every API/DB call
try {
  const result = await supabase.from('dreams').insert(data);
  if (result.error) throw result.error;
  return result.data;
} catch (error) {
  toast.error('꿈 저장에 실패했습니다');
  console.error('[DreamService]', error);
  throw error;
}
```
