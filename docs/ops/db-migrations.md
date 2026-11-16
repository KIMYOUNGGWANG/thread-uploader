# DB 마이그레이션 런북

## 평소 절차 (스키마를 바꿀 때마다)
1. `DATABASE_URL`을 **로컬 Postgres**로 지정한다. 운영 주소에는 절대 쓰지 않는다. `migrate dev`는 차이를 보면 DB 리셋을 제안하고, 수락하면 데이터가 전부 지워진다.
2. `npx prisma migrate dev --name <변경 이름>`을 실행한다. 마이그레이션 SQL이 만들어지고 로컬에 적용된다. 생성된 SQL을 읽어 본다.
3. `schema.prisma`와 `prisma/migrations/<새 폴더>`를 같은 커밋에 넣는다. PR의 `Prisma migration drift` 워크플로는 마이그레이션을 빈 DB에 다시 쌓은 결과가 스키마와 다르면 실패한다.
4. main에 머지한 뒤, 운영에는 main 체크아웃에서 `migrate deploy`만 실행한다(아래 "운영 명령 규칙").

## 운영 명령 규칙
- **운영 주소는 셸 환경변수로만 넘긴다.** 명령줄에 비밀번호를 쓰지 않는다. 풀러(pgbouncer)가 아닌 **직결(direct) 주소**를 쓴다.
  ```bash
  read -rs PROD_DB_URL && export PROD_DB_URL
  ```
- **Prisma는 설치된 버전으로 실행한다.** `node_modules/.bin/prisma`(5.22)를 쓰고, 명령마다 `DATABASE_URL`을 명시한다. 이러면 `.env`가 무엇을 가리키든 상관없다.
- **운영에 금지:** `migrate dev`, `db push`, `migrate reset`.
- **같은 섀도 DB를 계속 쓴다면:** 다음 실행이 `relation ... already exists in schema "archive"`로 실패할 수 있다. 그 **섀도 DB에서만** `DROP SCHEMA archive CASCADE`를 실행한다. `migrate dev`가 알아서 만드는 임시 섀도 DB와 CI는 해당 없다.

## 처음 한 번: 운영 DB를 마이그레이션 이력에 맞추기
### 배경
- `ConversionEvent` 표와 `Post` 컬럼 6개는 스키마에만 있었고, 이를 만드는 마이그레이션이 없었다.
- 옛 마이그레이션이 만든 표 6개는 스키마에서 빠졌다.
- 운영 DB는 마이그레이션 밖(`db push` 등)에서 맞춰졌을 가능성이 높다.

### 새로 추가한 마이그레이션 (`20261116…` 세 개)
- `20261116000000_archive_orphan_tables`
  - 모델이 없는 표 6개(`DiscoveredAccount`, `DiscoveredAccountPost`, `AccountPattern`, `DemoAssetJob`, `DemoCaptureArtifact`, `DemoRenderedAsset`)를 `archive` 스키마로 **옮긴다**. 지우지 않으니 데이터는 그대로 남는다.
  - 이 표들의 `Brand` FK 3개는 끊는다. 원래 `ON DELETE CASCADE`라, 그대로 두면 브랜드를 지울 때 보관 데이터까지 지워진다.
- `20261116000100_reconcile_schema_drift`
  - `ConversionEvent` 표, 인덱스, FK를 만든다.
  - `Post` 컬럼 6개를 추가한다.
  - `threadPartIds`의 NULL을 `'[]'`로 채운 뒤 NOT NULL로 바꾼다. 앱은 이미 NULL을 `"[]"`로 읽고 있어서 의미는 같다.
  - 옛 인덱스 3개를 스키마의 인덱스로 바꾼다.
  - 이미 있는 객체는 모두 건너뛴다.
- `20261116000200_add_rate_limit_bucket`
  - 로그인 시도 횟수를 세는 새 표 `RateLimitBucket`을 만든다. 기존 데이터는 건드리지 않는다.
  - 이 표가 생기기 전에 코드가 먼저 배포돼도 로그인은 막히지 않는다. 다만 시도마다 "NOT limited" 에러 로그가 남는다.
- 앞의 두 마이그레이션은 `lock_timeout` 5초로 돈다. 크론과 락이 겹치면 기다리지 않고 **통째로 되돌린 뒤 실패**한다(로컬 검증 f).

### 0. 준비 (5분)
1. DB 제공자 화면에서 백업 또는 PITR(시점 복구)이 켜져 있는지 확인한다.
2. 이 PR이 머지된 main을 받는다(`git checkout main && git pull`).
3. 위 "운영 명령 규칙"대로 `PROD_DB_URL`을 설정한다.

### 1. 읽기 전용 진단 (10분)
```bash
DATABASE_URL="$PROD_DB_URL" node_modules/.bin/prisma migrate status
node_modules/.bin/prisma migrate diff --from-url "$PROD_DB_URL" --to-schema-datamodel prisma/schema.prisma --script > prod-before.sql
psql "$PROD_DB_URL" -At <<'SQL'
select version();
select has_database_privilege(current_user, current_database(), 'CREATE') as can_create_schema;
select c.relname, pg_get_userbyid(c.relowner) as owner, current_user
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relkind = 'r'
   and c.relname in ('Post','ThreadReply','ConversionEvent','DiscoveredAccount','DiscoveredAccountPost',
                     'AccountPattern','DemoAssetJob','DemoCaptureArtifact','DemoRenderedAsset');
SQL
```
`ConversionEvent` 표가 이미 있으면 제약을 어기는 행 수도 센다. 표가 없으면 이 단계는 건너뛴다.
```bash
psql "$PROD_DB_URL" -At <<'SQL'
select 'brand 없음', count(*) from "ConversionEvent" e where not exists (select 1 from "Brand" b where b.id = e."brandId");
select 'post 없음', count(*) from "ConversionEvent" e where e."postId" is not null and not exists (select 1 from "Post" p where p.id = e."postId");
select 'idempotencyKey 중복', count(*) from (select "idempotencyKey" from "ConversionEvent" where "idempotencyKey" is not null group by 1 having count(*) > 1) d;
SQL
```

### 2. 판정 — 하나라도 걸리면 멈추고 결과를 공유한다
**`prod-before.sql`에 나와도 되는 것** (새 마이그레이션들이 처리하는 것)은 아래뿐이다:
- 표 6개(`DiscoveredAccount`, `DiscoveredAccountPost`, `AccountPattern`, `DemoAssetJob`, `DemoCaptureArtifact`, `DemoRenderedAsset`): `DROP TABLE`, 그리고 이 표들의 FK `DROP CONSTRAINT`
- 옛 인덱스 3개 `DROP INDEX`: `Post_status_idx`, `ThreadReply_authorUsername_idx`, `ThreadReply_postThreadsId_idx`
- `Post`
  - `ADD COLUMN` 6개: `postCategory`, `algorithmicScore`, `algorithmicPass`, `algorithmicDimensions`, `algorithmicFixes`, `rewriteCount`
  - `threadPartIds`: `SET NOT NULL`, `SET DEFAULT '[]'`
- `ConversionEvent`: `CREATE TABLE`, 인덱스 3개, FK 2개
- `RateLimitBucket`: `CREATE TABLE`, 인덱스 1개
- 새 인덱스 4개 `CREATE INDEX`: `Post_brandId_status_idx`, `Post_brandId_postCategory_status_idx`, `ThreadReply_brandId_postThreadsId_idx`, `ThreadReply_brandId_createdAt_idx`

**멈춰야 하는 경우:**
- 그 밖의 줄이 하나라도 있다. 예: 컬럼 타입 변경, 위에 없는 표나 컬럼.
- 제약 위반 행 수가 0이 아니다.
- `can_create_schema`가 `f`다.
- 위 표 중 `owner`가 `current_user`와 다르다. 이때는 `SET SCHEMA`와 `ALTER TABLE`이 "must be owner"로 실패한다.

### 3. 이력 맞추기 (`migrate status` 결과에 따라)
- **새 마이그레이션(`20261116…`)만 pending이면:** 4단계로 간다.
- **옛 마이그레이션도 pending이면** (이력이 비었거나 일부만 있는 경우):
  - 2단계를 통과했다면 옛 마이그레이션의 효과는 이미 DB에 있다. 스키마가 모델링하는 부분이 허용 목록 밖으로 다르지 않다는 뜻이기 때문이다.
  - 옛 pending마다 `DATABASE_URL="$PROD_DB_URL" node_modules/.bin/prisma migrate resolve --applied <이름>`을 실행한다.
  - **`20261116…`로 시작하는 새 마이그레이션은 절대 resolve하지 않는다. 반드시 deploy로 실행한다.**
  - 참고: 옛 마이그레이션 중 데이터를 바꾸는 문장은 `20260515010000_add_post_published_at`의 `UPDATE "Post"`(publishedAt 백필) 하나다. resolve하면 실행되지 않지만, 운영은 지금까지 그 상태로 돌아왔으니 동작은 바뀌지 않는다.
- **`failed`로 표시된 행이 있으면:**
  - **옛 마이그레이션이면:** 2단계를 통과했을 때 `--applied`.
  - **새 마이그레이션(`20261116…`) 중 하나면:** 실패한 마이그레이션은 한 트랜잭션째 되돌려진다(로컬 검증 f, e). `--rolled-back`으로 표시한 뒤 4단계를 다시 한다.
  - **판정이 애매하면:** 멈추고 공유한다.

### 4. 적용 (5분)
- 크론이 쉬는 때에 한다. 발행 워크플로는 15분마다(`*/15`) 돈다. 매 15분 정각에서 5~10분 지난 때가 좋다.
- 락이 겹쳐도 5초 뒤 깔끔히 실패할 뿐이니, 3단계의 `failed` 절차대로 다시 하면 된다.
```bash
DATABASE_URL="$PROD_DB_URL" node_modules/.bin/prisma migrate deploy
```

### 5. 확인 (2분) — 필수
```bash
node_modules/.bin/prisma migrate diff --from-url "$PROD_DB_URL" --to-schema-datamodel prisma/schema.prisma --exit-code
```
"No difference detected"(exit 0)가 나와야 끝이다. 다른 결과가 나오면 출력을 공유한다. `IF NOT EXISTS`는 이름만 보기 때문에, 같은 이름인데 모양(타입, NULL 허용, 인덱스 컬럼)이 다르면 이 단계에서만 드러난다.

### 되돌리기
- **보관한 표:** `ALTER TABLE archive."<표>" SET SCHEMA public;` 데이터는 그대로다. 끊은 `Brand` FK 3개는 옛 마이그레이션의 `ADD CONSTRAINT` 문으로 다시 만든다.
- **reconcile:** 추가만 하므로 되돌릴 일이 거의 없다. `threadPartIds` 백필(NULL → `'[]'`)은 되돌릴 수 없지만 앱이 이미 같은 뜻으로 읽는다.

## 로컬 검증 기록 (2026-11-16, Postgres 16.13, Prisma 5.22)
| | 시나리오 | 결과 |
|---|---|---|
| a | 빈 DB에 `migrate deploy` → `migrate diff --from-url … --exit-code` | 차이 없음 |
| b | `--from-migrations … --shadow-database-url … --exit-code` (CI 가드와 같은 명령) | 차이 없음. 스키마만 바꾸면 exit 2 |
| c | `db push`로 만든 DB + 옛 이력 전부 `resolve --applied` → deploy | 새 2개만 적용. `pg_dump --schema-only` 차이는 빈 `archive` 스키마뿐 |
| d | 혼합 상태: FK 없는 `ConversionEvent`(행 1개), 컬럼 1개만 있음, `threadPartIds` NULL 행, 고아 표에 행 | 차이 없음. 고아 표는 행째 `archive`로, NULL은 `[]`로, FK 추가됨 |
| e | 이력 절반만 있는 동기화 DB에 deploy | 옛 마이그레이션에서 P3018. 위 3단계(`--applied`)로 복구 후 차이 없음 |
| f | 다른 세션이 `Post`를 잡은 채 deploy | 6초 뒤 `lock timeout`으로 실패, 그 마이그레이션은 통째로 되돌려짐. `--rolled-back` 후 재실행 성공 |
| g | 적용 후 `migrate dev` | "Already in sync" |
