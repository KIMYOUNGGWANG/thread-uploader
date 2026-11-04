# 실험: 타래로그 첫 7일 퍼널 탐색 (taraelog)

사전 등록 문서야. 실험이 시작되면 아래 가설, 지표, 판정 기준은 바꾸지 않아.

## 제품

- **타래로그** — 예전에 쓴 내 네이버 블로그 글을 읽고, 내 말투 그대로 새 글 초안을 써 주는 무료 도구야.
- 랜딩: https://taraelog.taraetool.workers.dev/
- 차별점: "내 말투"와 "사실은 내가"(모르는 경험·가격은 `[직접 채우기]` 빈칸으로 남김).
- 조건: 가입비·구독 0원. 대신 구글 Gemini 무료 API 키가 필요하고, 저장·발행·사진은 사용자가 직접 해.
- 설정 원본: `scripts/taraelog-brand-config.js` (제품 프로필, 캠페인, 공식, 금지 표현)

## 왜 탐색 실험인가

- 타래로그는 Threads 기록이 하나도 없어. 비교할 기준선도 없어서, 처음 7일은 효과 크기를 재는 게 아니라 **퍼널의 어느 칸에서 사람이 빠지는지**만 확인해.
- cosmicpath 측정에서 같은 글을 두 번 올려도 조회수가 1.42배(중앙값) 차이 났어(`2026-10-16-post-length.md`). 그래서 14편 안에서 공식끼리 비교한 숫자는 판정에 쓰지 않아.

## 가설

H1: 네이버 블로거에게 "내 말투 + 지어내지 않음" 메시지는 링크 클릭을 만들지만, 클릭 대비 가입은 가입·Gemini 키 단계에서 막힌다.

## 설계

- **브랜드:** `taraelog` (새 Threads 계정)
- **캠페인:** `taraelog_launch_probe_v1`, `product_growth` 품질 프로필
- **기간:** 시작 시각(`startedAt`)부터 7일
- **발행량:** 신뢰 등급 `warming` → 하루 최대 2편, 약 14편
- **링크:** 2편에 1편꼴로 첫 댓글에 링크. 링크마다 `pid`(글 ID)와 `utm_campaign=taraelog_launch_probe_v1`이 붙어.
- **공식(가중치):** `quiet_contrarian` 3 (AI 글이 티 나는 진짜 이유), `saveable_tool` 3 (내 블로그 말투 점검표), `self_classification` 2 (막히는 지점 A/B/C), `friend_share` 2 (블로거 옆자리 관찰)
- **금지 표현:** 상위노출 약속, 네이버 공식처럼 보이는 표현, 자동 발행·자동 임시저장 약속, "100% 무료"

## 측정 준비 (타래로그 쪽 작업)

판정에 필요한 클릭·가입 수는 타래로그가 보내 줘야 들어와. 실험 시작 전에 타래로그에 아래를 넣어.

- **브라우저가 아니라 타래로그 Worker(서버)에서 보내.** 이 앱의 `/api/webhooks/conversion`은 CORS 헤더를 주지 않아서, 다른 도메인 페이지의 JS `fetch`는 막혀.

1. 랜딩 요청 URL에 `pid`가 있으면 Worker가 세션(쿠키)에 저장하고 한 번 보냄
   ```
   POST {이 앱 주소}/api/webhooks/conversion
   { "pid": "<pid>", "eventType": "landing_view", "sessionId": "<브라우저 세션 ID>" }
   ```
2. 가입 처리가 끝나면 Worker가 세션에 저장한 같은 `pid`로 한 번 보냄
   ```
   { "pid": "<pid>", "eventType": "signup", "sessionId": "<같은 세션 ID>" }
   ```
- `landing_view`는 클릭으로, `signup`은 전환으로 집계돼. `sessionId`로 중복 집계를 막아.
- 가능하면 "Gemini 키 저장 성공"도 따로 세어 둬. 지금 웹훅에는 이 이벤트 이름이 없어서, 7일 동안은 타래로그 쪽 로그로 숫자만 적어 둬.

이 작업이 안 되면 클릭과 가입 수를 매일 손으로 넣어(`/api/posts/{id}/campaign-metrics`). 그것도 안 되면 판정은 조회수와 프로필 방문까지만 해.

## 시작 방법

```bash
node --env-file=.env scripts/setup-taraelog-brand.mjs
node --env-file=.env scripts/setup-taraelog-brand.mjs --apply
```
- 제품이 생기고 실험은 `paused`(시작 시각 없음) 상태야.
- `/brands/taraelog/settings`에서 타래로그용 Threads 계정을 연결해.
- 측정 준비가 끝나면 시작해. 시작 시각이 기록되고 `active`가 돼. 다시 실행해도 시작 시각은 바뀌지 않아.
```bash
node --env-file=.env scripts/setup-taraelog-brand.mjs --apply --start
```
- 판정할 때는 DB에 기록된 `startedAt` 값을 그대로 써. 날짜만 쓰면 표본이 어긋나.

## 판정 (7일째, 한 번만)

| 관찰 | 해석 | 다음 실험 단계 |
|---|---|---|
| 링크 글 조회수 중앙값이 100 미만 | 아직 도달이 없어서 퍼널을 판단할 수 없음 | `content` 유지. 공식·주제를 바꾸지 말고 7일 더 쌓기 |
| 클릭 10 이상, 가입 0~1 | 랜딩·가입·키 단계가 병목 | `landing`. 가입 전 체험(말투 분석 미리보기)이나 예시 결과를 먼저 붙이기 |
| 클릭 10 이상, 가입 2 이상 | 메시지와 첫 단계가 통함 | `conversion`. 가입 후 첫 초안까지 가는 비율 보기 |
| 조회는 있는데 클릭 10 미만 | 메시지가 클릭을 못 만듦 | `content` 유지. 각도(말투 vs 지어내지 않음 vs 시간 절약)를 바꿔 다시 |

- 숫자 기준(100, 10, 2)은 새 계정 14편 기준의 대략적인 선이야. 효과 크기를 판정하는 기준이 아니라 다음에 볼 곳을 고르는 기준이야.
- 품질 통과율(`quality_pass_rate`)이 70% 아래로 떨어지면 판정 전에 생성 지시문부터 고쳐.
