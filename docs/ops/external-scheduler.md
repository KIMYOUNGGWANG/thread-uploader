# 외부 스케줄러 이전 (cron-job.org)

> 2026-10-22. GitHub Actions `schedule`은 몇 시간씩 밀리거나 빠진다(하루 3회만 돈 날이 있었음). Vercel Cron은 Hobby라 일 1회만 되고, DB는 Prisma Postgres라 pg_cron이 없다. 가장 간단한 이전은 cron-job.org(무료, 분 단위, 헤더 지원)다.
> 그동안 `cron.yml`은 15분 간격으로 돌려 지연을 흡수한다. 모든 라우트가 멱등(발행은 슬롯당 1회, 답글은 DB로 중복 방지)이라 두 스케줄러가 겹쳐 돌아도 안전하다.

## 설정 (5분)

1. https://cron-job.org 가입 → Cronjobs → Create cronjob.
2. 아래 표대로 잡을 만든다. 공통:
   - **Request method**: GET
   - **Headers**: `Authorization: Bearer <CRON_SECRET>` (값은 Vercel → Project → Settings → Environment Variables의 `CRON_SECRET`. 여기나 채팅에 적지 말 것)
   - **Timeout**: 120초 (발행·리필은 300초)
   - **Time zone**: UTC (슬롯 값이 UTC 기준)

| 잡 | URL | 주기 (UTC) | 비고 |
|---|---|---|---|
| publish KR | `https://thread-uploader.vercel.app/api/cron/publish?brands=cosmicpath&slots=0,3,9,12,14` | 매 15분 | 슬롯 KST 09/12/18/21/23. 슬롯 밖이면 즉시 `outside_publish_slot` |
| publish Global | `https://thread-uploader.vercel.app/api/cron/publish?brands=cosmicpath-global&slots=0,12` | 매 15분 | 하루 2슬롯 |
| replies | `https://thread-uploader.vercel.app/api/cron/replies` | 매시 17분 | 답글 게시 ≤3 → 댓글 스캔 ≤5 |
| account-intelligence | `https://thread-uploader.vercel.app/api/cron/account-intelligence` | 2시간마다 정각 | 팔로워 수 기록 |
| refill KR | `https://thread-uploader.vercel.app/api/cron/refill?brand=cosmicpath&target=10` | 06:13, 14:13, 22:13 | 타임아웃 300초 |
| refill Global | `https://thread-uploader.vercel.app/api/cron/refill?brand=cosmicpath-global&target=4` | 06:13, 14:13, 22:13 | 타임아웃 300초 |
| refresh-token | `https://thread-uploader.vercel.app/api/cron/refresh-token` | 매일 12:00 | 아래 둘보다 먼저 |
| fetch-metrics | `https://thread-uploader.vercel.app/api/cron/fetch-metrics` | 매일 12:05 | 48h 지표 갱신 |
| learn | `https://thread-uploader.vercel.app/api/cron/learn` | 매일 12:10 | growthMemory·가중치 재학습 |

3. 각 잡을 "Run now"로 한 번 실행해 응답이 `{"published": ...}` / `{"success": true ...}`인지 확인한다. 401이면 헤더 값이 틀린 것.

## 전환 뒤

- cron-job.org 실행 기록에서 하루치가 정상이면 `.github/workflows/`의 `schedule` 블록을 주석 처리한다(`workflow_dispatch`는 남겨 수동 실행용). 둘 다 켜둬도 동작엔 문제없고 GitHub 쪽은 비용 0(공개 저장소)이라 급하지 않다.
- 발행 슬롯을 바꾸려면 URL의 `slots=`만 고치면 된다. 코드 변경 없음.
