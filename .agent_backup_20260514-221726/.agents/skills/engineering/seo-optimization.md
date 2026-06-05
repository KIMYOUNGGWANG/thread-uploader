---
name: seo-optimization
description: Next.js App Router SEO 최적화 패턴. generateMetadata API, JSON-LD 구조화 데이터, sitemap.ts, robots.ts, Open Graph, Core Web Vitals. SEO 구현, metadata 설정, 검색 순위 개선, 소셜 공유 최적화 시 사용.
risk: safe
---

# 🔍 SEO Optimization

Next.js App Router SEO implementation patterns with code examples.

## Metadata API

### 정적 Metadata

```typescript
// app/layout.tsx
import type { Metadata } from 'next'

export const metadata: Metadata = {
  metadataBase: new URL('https://example.com'),
  title: {
    default: '서비스명',
    template: '%s | 서비스명',  // 각 페이지: "페이지명 | 서비스명"
  },
  description: '서비스 설명 (140자 이내)',
  openGraph: {
    type: 'website',
    locale: 'ko_KR',
    url: 'https://example.com',
    siteName: '서비스명',
    images: [{ url: '/og-image.png', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    creator: '@username',
  },
  robots: {
    index: true,
    follow: true,
  },
}
```

### 동적 Metadata (generateMetadata)

```typescript
// app/posts/[slug]/page.tsx
import type { Metadata } from 'next'

interface Props {
  params: { slug: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const post = await getPost(params.slug)

  if (!post) return { title: 'Not Found' }

  return {
    title: post.title,
    description: post.excerpt,
    openGraph: {
      title: post.title,
      description: post.excerpt,
      type: 'article',
      publishedTime: post.createdAt.toISOString(),
      authors: [post.author.name],
      images: [{ url: post.coverUrl, width: 1200, height: 630 }],
    },
    alternates: {
      canonical: `https://example.com/posts/${params.slug}`,
    },
  }
}
```

## 구조화 데이터 (JSON-LD)

```typescript
// components/shared/JsonLd.tsx
interface ArticleJsonLdProps {
  title: string
  description: string
  url: string
  publishedAt: string
  authorName: string
  imageUrl: string
}

export function ArticleJsonLd({
  title, description, url, publishedAt, authorName, imageUrl
}: ArticleJsonLdProps) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: title,
    description,
    url,
    datePublished: publishedAt,
    author: { '@type': 'Person', name: authorName },
    image: imageUrl,
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  )
}

// FAQ 구조화 데이터
export function FaqJsonLd({ faqs }: { faqs: Array<{ q: string; a: string }> }) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map(({ q, a }) => ({
      '@type': 'Question',
      name: q,
      acceptedAnswer: { '@type': 'Answer', text: a },
    })),
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  )
}
```

## Sitemap & Robots

```typescript
// app/sitemap.ts
import type { MetadataRoute } from 'next'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const posts = await getAllPosts()

  const staticPages: MetadataRoute.Sitemap = [
    { url: 'https://example.com', lastModified: new Date(), changeFrequency: 'daily', priority: 1 },
    { url: 'https://example.com/about', lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
  ]

  const dynamicPages: MetadataRoute.Sitemap = posts.map(post => ({
    url: `https://example.com/posts/${post.slug}`,
    lastModified: post.updatedAt,
    changeFrequency: 'weekly',
    priority: 0.7,
  }))

  return [...staticPages, ...dynamicPages]
}

// app/robots.ts
import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: '*', allow: '/', disallow: ['/api/', '/admin/', '/_next/'] },
    ],
    sitemap: 'https://example.com/sitemap.xml',
  }
}
```

## On-Page SEO 체크리스트

### 콘텐츠
- [ ] Title: 고유, 60자 이내, 주 키워드 포함
- [ ] Description: 140자 이내, CTA 포함
- [ ] H1 태그: 페이지당 하나, 주 키워드 자연스럽게 포함
- [ ] 헤딩 계층: H1 → H2 → H3 (레벨 건너뛰기 금지)
- [ ] 이미지 alt: 설명적, 키워드 관련성 있게

### 기술 SEO
- [ ] Canonical URL 설정 (중복 콘텐츠 방지)
- [ ] `next/image` 사용 (WebP 자동 변환, lazy loading)
- [ ] 시맨틱 HTML: `<main>`, `<article>`, `<section>`, `<nav>`
- [ ] sitemap.ts 구현 및 Google Search Console 제출
- [ ] robots.ts로 크롤링 제어
- [ ] JSON-LD 구조화 데이터 (Article, FAQ, Product 등)

### Core Web Vitals
- [ ] LCP < 2.5s: 히어로 이미지에 `priority` 속성
- [ ] CLS < 0.1: 이미지 크기 명시, `font-display: swap`
- [ ] INP < 200ms: 무거운 이벤트는 `useTransition`으로 처리

### Next.js 특화
- [ ] `generateStaticParams`로 동적 라우트 정적 생성
- [ ] `loading.tsx`, `error.tsx` 구현 (UX 신호 개선)
- [ ] `next/font`로 폰트 최적화 (layout shift 방지)

## Anti-Patterns

- ❌ 키워드 스터핑 (자연스럽지 않은 키워드 반복)
- ❌ 페이지마다 동일한 meta description
- ❌ 이미지 alt 누락
- ❌ `<img>` 태그 직접 사용 (next/image 사용)
- ❌ 중복 canonical URL
- ❌ 크롤러가 접근해야 하는 페이지 robots로 차단

## Page Launch Checklist

- [ ] title / description / canonical 이 페이지 목적에 맞게 고유한가?
- [ ] OG image 와 social preview 가 실제로 존재하는가?
- [ ] JSON-LD 가 페이지 타입과 맞는가?
- [ ] lighthouse 에서 SEO 기본 항목이 깨지지 않는가?

## Measurement Targets

- Click-through 개선 전에는 title/description 변경 이유를 남긴다.
- 인덱싱 대상 페이지는 canonical, sitemap, robots 가 서로 모순되지 않아야 한다.
- 긴 글 페이지는 목차, heading hierarchy, OG, published time 을 함께 본다.
