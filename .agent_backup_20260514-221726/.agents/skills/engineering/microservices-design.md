---
name: microservices-design
description: 마이크로서비스 설계 원칙 — 서비스 분리 기준, 통신 패턴, Docker 기반 로컬 운용
tags: [microservices, docker, api-design, system-design, architecture]
---

# Microservices Design Principles

> 이 문서는 설계 원칙과 Docker 기반 로컬 운용 가이드만 다룬다.
> Kubernetes, 클라우드 인프라는 범위 밖이다.

---

## 서비스 분리 기준 (언제 나눌까)

### 나눠야 할 때
- 팀이 서로 독립적으로 배포해야 할 때
- 특정 서비스만 스케일이 필요할 때 (예: 알림 서비스만 트래픽 급증)
- 기술 스택이 달라야 할 때 (예: 분석은 Python, API는 Node)
- 장애 격리가 필요할 때 (결제 서비스가 죽어도 조회는 살아야)

### 나누지 말아야 할 때
- 팀이 1~3명일 때 → 모노리스가 낫다
- 데이터가 강하게 결합되어 있을 때 → 분산 트랜잭션 지옥
- MVP / 초기 스타트업 → 먼저 모노리스로 검증, 나중에 분리

---

## 서비스 경계 설계 (도메인 기반)

```
모노리스 → 마이크로서비스 분리 예시 (이커머스):

[모노리스]
  users / products / orders / payments / notifications

[분리 기준: 독립 배포 + 팀 소유권]
  user-service      → 인증, 프로필
  catalog-service   → 상품, 재고
  order-service     → 주문, 장바구니
  payment-service   → 결제 (외부 PG 연동)
  notification-service → 이메일, SMS, 푸시
```

**원칙**: 서비스는 데이터베이스를 공유하지 않는다. 각 서비스가 자신의 DB를 소유한다.

---

## 통신 패턴

| 상황 | 패턴 | 예시 |
|------|------|------|
| 실시간 응답 필요 | **동기 REST / gRPC** | 주문 생성 → 재고 확인 |
| 결과를 기다릴 필요 없음 | **비동기 이벤트** | 주문 완료 → 이메일 발송 |
| 여러 서비스에 동시 알림 | **Pub/Sub** | 결제 완료 → 알림 + 통계 + 이력 |

### REST API 통신 규칙
```
- 서비스 간 직접 DB 접근 절대 금지
- 타 서비스 호출 시 항상 timeout + retry 설정
- 실패 시 Circuit Breaker 패턴 적용
```

---

## Docker Compose 기반 로컬 운용

```yaml
# docker-compose.yml
version: '3.9'

services:
  user-service:
    build: ./services/user-service
    ports:
      - "3001:3000"
    environment:
      - DATABASE_URL=postgresql://postgres:password@user-db:5432/users
    depends_on:
      - user-db

  order-service:
    build: ./services/order-service
    ports:
      - "3002:3000"
    environment:
      - DATABASE_URL=postgresql://postgres:password@order-db:5432/orders
      - USER_SERVICE_URL=http://user-service:3000
    depends_on:
      - order-db

  user-db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: users
      POSTGRES_PASSWORD: password
    volumes:
      - user-db-data:/var/lib/postgresql/data

  order-db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: orders
      POSTGRES_PASSWORD: password
    volumes:
      - order-db-data:/var/lib/postgresql/data

volumes:
  user-db-data:
  order-db-data:
```

### 유용한 명령어

```bash
# 전체 시작
docker compose up -d

# 특정 서비스만 재빌드
docker compose up -d --build order-service

# 로그 실시간 확인
docker compose logs -f order-service

# 전체 중지 + 볼륨 삭제 (초기화)
docker compose down -v
```

---

## API Gateway 패턴 (클라이언트 단순화)

```
클라이언트 → API Gateway → user-service
                         → order-service
                         → payment-service
```

간단한 구현: **Next.js API Routes를 Gateway로** 사용

```typescript
// app/api/orders/route.ts — Gateway 역할
export async function POST(request: Request) {
  const body = await request.json();

  // 1. 사용자 확인 (user-service)
  const user = await fetch(`${process.env.USER_SERVICE_URL}/users/${body.userId}`);

  // 2. 재고 확인 (catalog-service)
  const stock = await fetch(`${process.env.CATALOG_SERVICE_URL}/stock/${body.productId}`);

  // 3. 주문 생성 (order-service)
  const order = await fetch(`${process.env.ORDER_SERVICE_URL}/orders`, {
    method: 'POST',
    body: JSON.stringify(body),
  });

  return Response.json(await order.json());
}
```

---

## 모노리스 우선 전략 (권장)

```
Phase 1: 모노리스로 시작 (빠른 검증)
  → Next.js + Supabase 단일 앱

Phase 2: 모듈 경계 명확화 (준비)
  → 코드 내에서 서비스별 디렉토리 분리
  → 직접 DB 쿼리 → 서비스 레이어 추상화

Phase 3: 필요한 서비스만 분리 (선택)
  → 트래픽/팀/기술 이유가 있을 때만
  → Docker Compose로 로컬 테스트
```

**이 오케스트레이터의 기본 전략**: Phase 1 → Phase 2까지는 `/develop` 워크플로우로 처리 가능.
Phase 3 분리 작업은 `/plan 모노리스 분리` → `/ddd` → `/develop` 순서로 진행.

## Event Example

```json
{
  "event": "order.created",
  "eventId": "evt_123",
  "occurredAt": "2026-04-12T12:00:00Z",
  "payload": {
    "orderId": "ord_456",
    "userId": "usr_789"
  }
}
```

## Decision Checklist

- [ ] 서비스마다 독립 배포 이유가 실제로 있는가?
- [ ] DB 소유권이 서비스별로 분리되는가?
- [ ] 동기 호출 실패 시 timeout / retry / fallback 이 있는가?
- [ ] 모노리스로도 충분한 문제를 복잡하게 쪼개고 있지 않은가?

## Anti-Patterns

- 공유 DB로만 느슨하게 연결된 `가짜 마이크로서비스`
- 분산 트랜잭션 없이는 못 도는 경계 설계
- 팀/운영 규모가 작은데 인프라 복잡도만 키우는 분리
