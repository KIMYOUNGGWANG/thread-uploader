---
name: ai-app-integration
description: LLM / Claude API / OpenAI 통합 패턴 — Prompt Engineering, RAG, Tool Use, Agent Loop
tags: [ai, llm, claude-api, openai, rag, prompt-engineering, vector-db]
---

# AI App Integration Skill

## 모델 선택 기준

| 상황 | 추천 모델 | 이유 |
|------|----------|------|
| 기본 작업 (요약, 분류, 번역) | `claude-haiku-4-5-20251001` | 빠름 + 저렴 |
| 복잡한 추론, 코드 생성 | `claude-sonnet-4-6` | 균형 |
| 최고 난이도 (전략, 분석) | `claude-opus-4-6` | 최강 성능 |
| OpenAI 필요 시 | `gpt-4o` | 범용 |

## 패턴 1: Simple Generation

```typescript
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic(); // ANTHROPIC_API_KEY 환경변수 자동 사용

const response = await client.messages.create({
  model: 'claude-sonnet-4-6',
  max_tokens: 1024,
  messages: [{ role: 'user', content: userInput }],
  system: systemPrompt, // prompts/system.txt에서 로드
});

return response.content[0].text;
```

## 패턴 2: Streaming

```typescript
const stream = await client.messages.stream({
  model: 'claude-sonnet-4-6',
  max_tokens: 2048,
  messages: [{ role: 'user', content: userInput }],
});

for await (const chunk of stream) {
  if (chunk.type === 'content_block_delta') {
    yield chunk.delta.text; // 실시간 스트리밍
  }
}
```

## 패턴 3: Tool Use (Function Calling)

```typescript
const tools = [
  {
    name: 'search_database',
    description: 'Search the product database',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
      },
      required: ['query'],
    },
  },
];

const response = await client.messages.create({
  model: 'claude-sonnet-4-6',
  max_tokens: 1024,
  tools,
  messages,
});

if (response.stop_reason === 'tool_use') {
  const toolUse = response.content.find((c) => c.type === 'tool_use');
  const result = await executeToolCall(toolUse.name, toolUse.input);
  // 결과를 messages에 추가 후 재호출
}
```

## 패턴 4: RAG (Retrieval-Augmented Generation)

```typescript
// 1. 임베딩 생성 (Supabase pgvector 사용 예시)
async function embedAndStore(text: string, metadata: object) {
  const embedding = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
  });
  await supabase.from('documents').insert({
    content: text,
    embedding: embedding.data[0].embedding,
    metadata,
  });
}

// 2. 유사도 검색
async function retrieveContext(query: string, topK = 5) {
  const queryEmbedding = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: query,
  });
  const { data } = await supabase.rpc('match_documents', {
    query_embedding: queryEmbedding.data[0].embedding,
    match_count: topK,
  });
  return data.map((d: { content: string }) => d.content).join('\n\n');
}

// 3. 컨텍스트 주입
const context = await retrieveContext(userQuery);
const response = await client.messages.create({
  model: 'claude-sonnet-4-6',
  max_tokens: 2048,
  system: `당신은 다음 문서를 기반으로 답변합니다:\n\n${context}`,
  messages: [{ role: 'user', content: userQuery }],
});
```

## 보안 체크리스트

- [ ] API 키는 환경변수(`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`)만 사용
- [ ] 사용자 입력을 시스템 프롬프트에 직접 삽입 금지 (Prompt Injection)
- [ ] 응답 내 코드 실행 전 샌드박싱
- [ ] 토큰 한도(`max_tokens`) 항상 명시
- [ ] Rate limit 처리: `@anthropic-ai/sdk`의 자동 재시도 활용

## 비용 최적화

- 프롬프트 캐싱 활용 (반복 시스템 프롬프트)
- 불필요한 컨텍스트 제거 (슬라이딩 윈도우)
- Haiku → Sonnet → Opus 단계적 에스컬레이션
- 스트리밍으로 TTFB 개선 (사용자 체감 속도 향상)

## 프롬프트 관리

```
prompts/
  system/
    assistant.txt      # 기본 어시스턴트 역할
    analyst.txt        # 분석 역할
  user/
    summarize.txt      # 요약 템플릿
    classify.txt       # 분류 템플릿
```

프롬프트는 코드가 아닌 파일로 관리 → 버전 관리 + A/B 테스트 가능.
