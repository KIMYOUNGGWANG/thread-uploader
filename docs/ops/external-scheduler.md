# 외부 스케줄러 이전 (cron-job.org)

> 2026-10-22. GitHub Actions `schedule`은 몇 시간씩 밀리거나 빠진다(하루 3회만 돈 날이 있었음). Vercel Cron은 Hobby라 일 1회만 되고, DB는 Prisma Postgres라 pg_cron이 없다. 가장 간단한 이전은 cron-job.org(무료, 분 단위, 헤더 지원)다.
> 그동안 `cron.yml`은 15분 간격으로 돌려 지연을 흡수한다. 모든 라우트가 멱등(발행은 슬롯당 1회, 답글은 DB로 중복 방지)이라 두 스케줄러가 겹쳐 돌아도 안전하다.

## 설정 (5분)

1. https://cron-job.org 가입 → Console → Settings → API → API 키 생성.
2. `.env.local`에 두 줄 추가 (둘 다 git에 들어가지 않음):
   - `CRONJOB_API_KEY=<방금 만든 키>`
   - `CRON_SECRET=<Vercel → Project → Settings → Environment Variables의 CRON_SECRET 값>`
3. 등록:

```bash
node --env-file=.env.local scripts/register-cronjobs.mjs
```

위는 드라이런이라 만들 잡만 출력한다. 확인 후 `--apply`를 붙여 실제로 만든다. 제목 기준으로 멱등이라 다시 돌려도 중복 생성되지 않는다.

```bash
node --env-file=.env.local scripts/register-cronjobs.mjs --apply
```

4. Console에서 각 잡을 "Run now"로 한 번 실행해 응답이 200인지 본다. 401이면 `CRON_SECRET`이 Vercel 값과 다른 것.

### 등록되는 잡 (시간 민감한 것만)

| 잡 | URL | 주기 (UTC) | 비고 |
|---|---|---|---|
| threads publish KR | `/api/cron/publish?brands=cosmicpath&slots=0,3,9,12,14` | 매시 02·17·32·47분 | 슬롯 KST 09/12/18/21/23. 슬롯 밖이면 즉시 `outside_publish_slot` |
| threads publish Global | `/api/cron/publish?brands=cosmicpath-global&slots=0,12` | 매시 05·20·35·50분 | 하루 2슬롯 |
| threads replies | `/api/cron/replies` | 매시 17분 | 답글 게시 ≤3 → 댓글 스캔 ≤5 |
| threads account-intelligence | `/api/cron/account-intelligence` | 2시간마다 정각 | 팔로워 수 기록 |

refill(하루 3회)과 refresh-token·fetch-metrics·learn(하루 1회)은 GitHub Actions에 그대로 둔다. 몇 시간 밀려도 문제없고, refill은 생성에 수 분이 걸려 무료 플랜의 30초 요청 제한에 맞지 않는다.

## 전환 뒤

- cron-job.org 실행 기록에서 하루치가 정상이면 `cron.yml`과 `account-intelligence.yml`의 `schedule` 블록을 주석 처리한다(`workflow_dispatch`는 남겨 수동 실행용). 둘 다 켜둬도 동작엔 문제없고 GitHub 쪽은 비용 0(공개 저장소)이라 급하지 않다.
- 발행 슬롯을 바꾸려면 `scripts/register-cronjobs.mjs`의 `slots=`를 고치고 Console에서 해당 잡을 지운 뒤 다시 `--apply`한다.
- 무료 플랜 제한(분 단위 실행, 요청 30초)은 가입 시 화면에서 한 번 확인한다.
