# 외부 스케줄러 이전

> 2026-10-22. GitHub Actions `schedule`은 몇 시간씩 밀리거나 빠진다(하루 2~3회만 돈 날이 있었고, 15분 간격으로 늘려도 똑같았다). Vercel Cron은 Hobby라 일 1회만 되고, DB는 Prisma Postgres라 pg_cron이 없다.
> 모든 라우트가 멱등(발행은 슬롯당 1회, 답글은 DB로 중복 방지)이라 스케줄러가 겹쳐 돌아도 안전하다.
>
> **선택지 A: Cloudflare Workers Cron (권장)** — 무료, 분 단위, 코드로 관리. 아래 "A" 절.
> **선택지 B: cron-job.org** — 배포 없이 API로 등록. 가입이 봇 검증에 막히는 경우가 있다. 아래 "B" 절.

## A. Cloudflare Workers Cron

코드는 `cloudflare/scheduler/`에 있다. `worker.js`가 `wrangler.toml`의 크론마다 깨어나 Vercel 라우트를 호출한다.

| 크론 (UTC) | 호출 |
|---|---|
| `*/15 * * * *` | 발행 KR(`slots=0,3,9,12,14`, KST 09/12/18/21/23) + 발행 Global(`slots=0,12`) |
| `17 * * * *` | 답글 루프 |
| `0 */2 * * *` | 계정 분석(팔로워 수) |

### 처음 한 번 (5분)

1. https://dash.cloudflare.com 가입.
2. 로그인 (브라우저가 열리고 승인 버튼 하나):

```bash
cd cloudflare/scheduler && npx wrangler login
```

3. 비밀값 등록. 프롬프트에 Vercel의 `CRON_SECRET` 값을 붙여넣는다(화면에 안 보이고 코드에도 안 남는다):

```bash
cd cloudflare/scheduler && npx wrangler secret put CRON_SECRET
```

4. 배포:

```bash
cd cloudflare/scheduler && npx wrangler deploy
```

배포가 끝나면 Cloudflare 대시보드 → Workers → `threads-uploader-scheduler` → Settings → Triggers에 크론 3개가 보인다. Logs 탭에서 `200 /api/cron/publish?...` 줄이 찍히면 끝.

- 스케줄을 바꿀 때는 `wrangler.toml`의 `crons`와 `worker.js`의 `ROUTES`를 같이 고치고(테스트가 둘의 일치를 검사한다) 다시 `npx wrangler deploy`.
- 테스트: `node --test cloudflare/scheduler/worker.test.mjs`
- 크론 트리거는 대기 시간 15분까지 허용(CPU만 10ms 제한, 응답 대기는 CPU를 안 씀)이라 호출마다 최대 290초까지 응답을 기다린다. 슬롯 안 발행은 30~60초 걸린다.
- `CRON_SECRET`이 Vercel 값과 다르면 로그에 `401 ... Unauthorized`가 찍힌다. 로컬 `.env` 값이 프로덕션과 같으면 이렇게 넣는다(값은 화면에 안 나옴):

```bash
node -e 'const m=require("fs").readFileSync(".env","utf8").match(/^CRON_SECRET=(.*)$/m);process.stdout.write(m[1].trim())' | npx wrangler secret put CRON_SECRET --name threads-uploader-scheduler
```

## B. cron-job.org

### 설정 (5분)

1. https://cron-job.org 가입 → Console → Settings → API → API 키 생성.
2. `.env.local` 파일을 만들고 한 줄 추가 (git에 들어가지 않음). `CRON_SECRET`은 이미 `.env`에 있다:
   - `CRONJOB_API_KEY=<방금 만든 키>`
3. 등록:

```bash
node --env-file=.env --env-file=.env.local scripts/register-cronjobs.mjs
```

위는 드라이런이라 만들 잡만 출력한다. 확인 후 `--apply`를 붙여 실제로 만든다. 제목 기준으로 멱등이라 다시 돌려도 중복 생성되지 않는다.

```bash
node --env-file=.env --env-file=.env.local scripts/register-cronjobs.mjs --apply
```

4. Console에서 각 잡을 "Run now"로 한 번 실행해 응답이 200인지 본다. 401이면 `CRON_SECRET`이 Vercel 값과 다른 것.

#### 등록되는 잡 (시간 민감한 것만)

| 잡 | URL | 주기 (UTC) | 비고 |
|---|---|---|---|
| threads publish KR | `/api/cron/publish?brands=cosmicpath&slots=0,3,9,12,14` | 매시 02·17·32·47분 | 슬롯 KST 09/12/18/21/23. 슬롯 밖이면 즉시 `outside_publish_slot` |
| threads publish Global | `/api/cron/publish?brands=cosmicpath-global&slots=0,12` | 매시 05·20·35·50분 | 하루 2슬롯 |
| instagram publish | `/api/cron/instagram-publish?brands=cosmicpath` | Cloudflare Worker `*/15 * * * *` (cron-job.org 미등록) | Threads 영상 글 → 릴스 교차 발행. 하루 1개, 3일 지난 글은 건너뜀 |
| threads replies | `/api/cron/replies` | 매시 17분 | 답글 게시 ≤3 → 댓글 스캔 ≤5 |
| threads account-intelligence | `/api/cron/account-intelligence` | 2시간마다 정각 | 팔로워 수 기록 |

refill(하루 3회)과 refresh-token·fetch-metrics·learn(하루 1회)은 GitHub Actions에 그대로 둔다. 몇 시간 밀려도 문제없고, refill은 생성에 수 분이 걸려 무료 플랜의 30초 요청 제한에 맞지 않는다.

## 전환 뒤

- cron-job.org 실행 기록에서 하루치가 정상이면 `cron.yml`과 `account-intelligence.yml`의 `schedule` 블록을 주석 처리한다(`workflow_dispatch`는 남겨 수동 실행용). 둘 다 켜둬도 동작엔 문제없고 GitHub 쪽은 비용 0(공개 저장소)이라 급하지 않다.
- 발행 슬롯을 바꾸려면 `scripts/register-cronjobs.mjs`의 `slots=`를 고치고 Console에서 해당 잡을 지운 뒤 다시 `--apply`한다.
- 무료 플랜 제한(분 단위 실행, 요청 30초)은 가입 시 화면에서 한 번 확인한다.
