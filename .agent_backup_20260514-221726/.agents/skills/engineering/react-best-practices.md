---
name: react-best-practices
description: React/Next.js 컴포넌트 패턴, 상태 관리, 성능 최적화, 폼 처리, 접근성. 컴포넌트 설계, 훅 작성, 가상화 목록, 애니메이션 구현 시 사용.
---

# Frontend Development Patterns

## ⚡ Quick Reference (간단한 작업은 이것만 읽어도 충분)

| 규칙 | ✅ | ❌ |
|------|----|----|
| 타입 | `unknown` + narrowing | `any` |
| 내보내기 | named export | default export |
| 데이터 fetch | TanStack Query | raw `useEffect` |
| 상태 | Zustand(글로벌) / useState(로컬) | Context 남용 |
| Server/Client | Server Component 우선 | `'use client'` everywhere |
| 긴 목록 | `useVirtualizer` | DOM에 전부 렌더 |
| 폼 검증 | Zod + safeParse | 직접 if문 |
| UI 상태 | loading · error · empty 모두 처리 | happy path만 |
| Import | `@/components/ui/button` 직접 | barrel import |

**컴포넌트 작성 규칙:**
- Composition > Inheritance. props 3단계 이상 → Zustand/Context
- `useMemo`/`useCallback` → 실제 성능 문제 시에만 (과도 사용 금지)
- Framer Motion: `AnimatePresence` + `motion.div` (exit 애니메이션)
- 접근성: `role`, `aria-*`, keyboard navigation (↑↓Enter Escape)

> 복잡한 패턴(복합 컴포넌트, 가상화, POM 패턴 등)은 아래 섹션 참조.

---

Modern frontend patterns for React, Next.js, and performant user interfaces.

## When to Activate

- Building React components (composition, props, rendering)
- Managing state (useState, useReducer, Zustand, Context)
- Implementing data fetching (TanStack Query, server components)
- Optimizing performance (memoization, virtualization, code splitting)
- Working with forms (validation, controlled inputs, Zod schemas)
- Building accessible, responsive UI patterns

## Component Patterns

### Composition Over Inheritance

```typescript
interface CardProps {
  children: React.ReactNode
  variant?: 'default' | 'outlined'
}

export function Card({ children, variant = 'default' }: CardProps) {
  return <div className={`card card-${variant}`}>{children}</div>
}

export function CardHeader({ children }: { children: React.ReactNode }) {
  return <div className="card-header">{children}</div>
}

export function CardBody({ children }: { children: React.ReactNode }) {
  return <div className="card-body">{children}</div>
}

// Usage
<Card>
  <CardHeader>Title</CardHeader>
  <CardBody>Content</CardBody>
</Card>
```

### Compound Components

```typescript
interface TabsContextValue {
  activeTab: string
  setActiveTab: (tab: string) => void
}

const TabsContext = createContext<TabsContextValue | undefined>(undefined)

export function Tabs({ children, defaultTab }: {
  children: React.ReactNode
  defaultTab: string
}) {
  const [activeTab, setActiveTab] = useState(defaultTab)

  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab }}>
      {children}
    </TabsContext.Provider>
  )
}

export function Tab({ id, children }: { id: string, children: React.ReactNode }) {
  const context = useContext(TabsContext)
  if (!context) throw new Error('Tab must be used within Tabs')

  return (
    <button
      className={context.activeTab === id ? 'active' : ''}
      onClick={() => context.setActiveTab(id)}
    >
      {children}
    </button>
  )
}
```

## Custom Hooks Patterns

### Toggle Hook

```typescript
export function useToggle(initialValue = false): [boolean, () => void] {
  const [value, setValue] = useState(initialValue)

  const toggle = useCallback(() => {
    setValue(v => !v)
  }, [])

  return [value, toggle]
}

// Usage
const [isOpen, toggleOpen] = useToggle()
```

### Debounce Hook

```typescript
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => clearTimeout(handler)
  }, [value, delay])

  return debouncedValue
}

// Usage — search with debounce
const [searchQuery, setSearchQuery] = useState('')
const debouncedQuery = useDebounce(searchQuery, 500)
```

## State Management Patterns

### Zustand Slice Pattern (Preferred)

```typescript
import { create } from 'zustand'

interface ItemStore {
  items: Item[]
  loading: boolean
  setItems: (items: Item[]) => void
  setLoading: (loading: boolean) => void
}

export const useItemStore = create<ItemStore>((set) => ({
  items: [],
  loading: false,
  setItems: (items) => set({ items }),
  setLoading: (loading) => set({ loading }),
}))
```

### Context + Reducer (for component-tree state)

```typescript
type Action =
  | { type: 'SET_ITEMS'; payload: Item[] }
  | { type: 'SET_LOADING'; payload: boolean }

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'SET_ITEMS':
      return { ...state, items: action.payload }
    case 'SET_LOADING':
      return { ...state, loading: action.payload }
    default:
      return state
  }
}
```

## Performance Optimization

### Memoization

```typescript
// ✅ useMemo for expensive computations
const sortedItems = useMemo(() => {
  return [...items].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}, [items])

// ✅ useCallback for functions passed to children
const handleSearch = useCallback((query: string) => {
  setSearchQuery(query)
}, [])

// ✅ React.memo for pure components
export const ItemCard = React.memo<ItemCardProps>(({ item }) => {
  return (
    <div className="item-card">
      <h3>{item.name}</h3>
    </div>
  )
})
```

### Code Splitting & Lazy Loading

```typescript
import { lazy, Suspense } from 'react'

const HeavyChart = lazy(() => import('./HeavyChart'))

export function Dashboard() {
  return (
    <Suspense fallback={<ChartSkeleton />}>
      <HeavyChart data={data} />
    </Suspense>
  )
}
```

### Virtualization for Long Lists

```typescript
import { useVirtualizer } from '@tanstack/react-virtual'

export function VirtualItemList({ items }: { items: Item[] }) {
  const parentRef = useRef<HTMLDivElement>(null)

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 100,
    overscan: 5
  })

  return (
    <div ref={parentRef} style={{ height: '600px', overflow: 'auto' }}>
      <div style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
        {virtualizer.getVirtualItems().map(virtualRow => (
          <div
            key={virtualRow.index}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: `${virtualRow.size}px`,
              transform: `translateY(${virtualRow.start}px)`
            }}
          >
            <ItemCard item={items[virtualRow.index]} />
          </div>
        ))}
      </div>
    </div>
  )
}
```

### Bundle Optimization (Next.js)

```typescript
// Avoid barrel imports — import directly
import { Button } from '@/components/ui/button'  // ✅
import { Button } from '@/components/ui'         // ❌ barrel

// Preload on hover
<Link href="/page" prefetch={true}>...</Link>

// Dynamic import for below-fold
const Modal = dynamic(() => import('./Modal'), { ssr: false })
```

## Form Handling Patterns

### With Zod Validation

```typescript
import { z } from 'zod'

const CreateItemSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().min(1, 'Description is required'),
})

type CreateItemInput = z.infer<typeof CreateItemSchema>

export function CreateItemForm() {
  const [errors, setErrors] = useState<Partial<Record<keyof CreateItemInput, string>>>({})

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const input = Object.fromEntries(formData)

    const result = CreateItemSchema.safeParse(input)
    if (!result.success) {
      const fieldErrors: Partial<Record<keyof CreateItemInput, string>> = {}
      result.error.issues.forEach(issue => {
        const field = issue.path[0] as keyof CreateItemInput
        fieldErrors[field] = issue.message
      })
      setErrors(fieldErrors)
      return
    }

    await createItem(result.data)
  }

  return (
    <form onSubmit={handleSubmit}>
      <input name="name" placeholder="Item name" />
      {errors.name && <span className="error">{errors.name}</span>}
      <button type="submit">Create</button>
    </form>
  )
}
```

## Error Boundary Pattern

```typescript
export class ErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  state = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error boundary caught:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div className="error-fallback">
          <h2>Something went wrong</h2>
          <button onClick={() => this.setState({ hasError: false })}>Try again</button>
        </div>
      )
    }
    return this.props.children
  }
}
```

## Animation Patterns

### Framer Motion

```typescript
import { motion, AnimatePresence } from 'framer-motion'

export function AnimatedList({ items }: { items: Item[] }) {
  return (
    <AnimatePresence>
      {items.map(item => (
        <motion.div
          key={item.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
        >
          <ItemCard item={item} />
        </motion.div>
      ))}
    </AnimatePresence>
  )
}
```

## Accessibility Patterns

### Keyboard Navigation

```typescript
const handleKeyDown = (e: React.KeyboardEvent) => {
  switch (e.key) {
    case 'ArrowDown':
      e.preventDefault()
      setActiveIndex(i => Math.min(i + 1, options.length - 1))
      break
    case 'ArrowUp':
      e.preventDefault()
      setActiveIndex(i => Math.max(i - 1, 0))
      break
    case 'Enter':
      onSelect(options[activeIndex])
      break
    case 'Escape':
      setIsOpen(false)
      break
  }
}

// Use proper ARIA roles
<div role="combobox" aria-expanded={isOpen} aria-haspopup="listbox" onKeyDown={handleKeyDown}>
```

## Anti-Patterns

- ❌ `any` 타입 사용 — `unknown` + type narrowing 사용
- ❌ 데이터 페칭에 raw `useEffect` — TanStack Query 사용
- ❌ 불필요한 `useMemo`/`useCallback` 남발 — 실제 성능 문제 시에만 사용
- ❌ props drilling 3단계 이상 — Zustand 또는 Context 사용
- ❌ barrel imports — 직접 파일 경로로 import
- ❌ 'use client' everywhere — Server Components 우선 사용
- ✅ loading, error, empty 상태 모두 처리
- ✅ named exports only (page.tsx, layout.tsx 제외)
- ✅ 긴 목록에는 virtualization 사용
