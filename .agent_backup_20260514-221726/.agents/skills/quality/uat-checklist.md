---
name: uat-checklist
description: User-acceptance checklist for WCAG 2.2 AA basics, responsive states, i18n, auth, forms, and destructive flows.
---

# UAT Checklist

릴리스 후보를 사람이 실제로 써봤을 때 깨지는 부분을 빠르게 잡아내는 체크리스트.

## 1. Critical User Flows

- 로그인 / 로그아웃
- 핵심 생성 / 수정 / 삭제
- 결제 또는 권한이 걸린 흐름
- 실패 후 복구 경로

## 2. State Coverage

모든 주요 화면에서 아래 상태를 확인한다.

- loading
- empty
- error
- success
- permission denied

## 3. Accessibility Basics

WCAG 2.2 AA 기준에서 최소한 아래를 본다.

- 키보드만으로 주요 흐름 이동 가능
- 포커스 표시가 사라지지 않음
- 버튼과 링크의 역할이 명확함
- 입력 요소에 label 또는 accessible name 존재
- 색만으로 상태를 구분하지 않음
- 대비가 너무 낮지 않음

## 4. Responsive Checks

- mobile, tablet, desktop 에서 레이아웃 붕괴 없음
- text overflow / button wrap / modal clipping 없음
- sticky header/footer 가 주요 CTA를 가리지 않음
- horizontal scroll 이 의도 없이 생기지 않음

## 5. Forms and Validation

- 필수값 누락 시 메시지가 나온다
- 서버 오류와 클라이언트 오류가 구분된다
- 제출 중 중복 클릭 방지가 있다
- 성공 후 다음 상태가 명확하다

## 6. Auth and Permissions

- 비로그인 사용자가 보호 경로에 접근할 때 처리 방식 명확
- 권한 없는 사용자는 destructive action 을 실행할 수 없음
- session 만료 시 복구 경로가 있다

## 7. I18n and Content

- 긴 텍스트나 locale 차이로 레이아웃이 깨지지 않는다
- 날짜, 통화, 시간대 표시가 혼동을 주지 않는다
- placeholder 문구나 TODO copy 가 남아 있지 않다

## 8. Destructive Actions

- 삭제, 해지, 초기화 같은 action 은 confirmation 또는 되돌리기 단서가 있다
- 실패했을 때 데이터 손실로 오해하지 않도록 상태를 보여준다

## Blocker Severity

- `P0`: 데이터 손실, 인증 우회, 핵심 경로 완전 실패
- `P1`: 릴리스 후보로 보기 어려운 큰 기능 실패
- `P2`: 우회 가능하지만 눈에 띄는 결함
- `P3`: polish 또는 copy 수준 이슈
