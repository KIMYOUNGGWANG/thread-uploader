# 외부 레퍼런스 레이더 + 구조 재작성 (reference replay) — 설계

- 날짜: 2026-10-27
- 브랜드: cosmicpath (국내 Threads). cosmicpath-global은 범위 밖(팔로워 6명, 도달 기반 없음).
- 상태: 빌더 체크 반영(질문 4개를 설계자 판단으로 정리), 사용자 최종 승인 대기
- 표기: **[사용자 결정]**은 대화에서 사용자가 정한 것, **[내 판단]**은 설계자가 정한 것으로 빌더가 근거를 갖고 바꿀 수 있다.

## 1. 왜 만드나

- 2026-10-26 운영 DB 분석: cosmicpath 글 조회수 중앙값은 두 달째 110대, 팔로워 546명. 역대 상위 글(42,329 / 9,482 / 5,521)은 모두 "누구나 겪는 상황 + 멈춰 세우는 첫 줄"이었고, 그 구조는 우리 공식 풀에 없다.
- 학습 루프 다섯 경로 중 생성에 실제로 꽂히는 건 `viralMemory`(바이럴 레퍼런스 → 프롬프트) 하나뿐인데, 그 수집(`viral.yml`)이 2026-10-22부터 꺼져 있다.
- 사용자가 원하는 것: **다른 사주 계정에서 터진 글을 찾아, 그 구조로 우리 제품에 맞는 글을 다시 쓰는 것.** 업계 제품(Taplio, Tweet Hunter, Postwise)도 전부 "라이브러리 → 구조만 추출 → 내 말투로 재작성" 방식이고, 문장을 가져오는 제품은 없다.
- **전제 제약 (2026-10-27 코드·Meta 문서 확인):** 공식 Threads API는 다른 계정 글의 좋아요·조회수를 주지 않는다. 받을 수 있는 건 (a) 계정 단위 지난 7일 합계(팔로워 수, 7일 좋아요·리포스트·인용·조회수), (b) 키워드 검색 TOP 순위, (c) 글 본문·시각·답글 유무뿐이다. 유료 데이터 API와 스크레이핑은 쓰지 않는다. **[사용자 결정]** 따라서 "그 계정 평소 대비 몇 배"는 만들 수 없고, 아래 3.1의 대리 점수로 고른다.

## 2. 목표 / 비목표 / 실패 조건

**목표**
1. 사주 계정 15~20개를 하루 2번 읽어, **이번 주 뜨는 계정**(7일 조회수 ÷ 팔로워)과 **검색 TOP에 반복 노출되는 글**을 찾는다. **[사용자 결정: 공식 API만]**
2. 찾은 글마다 Claude가 **구조만**(첫 줄이 멈춰 세우는 방식, 본문 흐름, 끝맺음) 뽑아 우리 소재·말투로 새 글을 쓴다. 문장·표현은 0% 재사용. **[내 판단, 근거: 업계 공통 방식 + Meta 비원본 콘텐츠 정책]**
3. 이 글(`ref_replay`)은 하루 최대 1개 생성하고, 길이 실험 중에도 발행한다. **[사용자 결정]** 실험 표본과 시퀀스에는 들어가지 않는다.
4. 글마다 어느 계정의 어느 글에서 왔는지 남겨, 20개가 쌓이면 효과를 판정한다(6장).
5. 수집이 멈추면 사람이 알게 한다. 7주간 아무도 모르게 멈췄던 지표 수집의 전례를 반복하지 않는다.

**비목표**
- 글 단위 좋아요·조회수 확보(유료 API, 스크레이핑). 공식 API가 주지 않는 건 추측하지 않는다.
- 번안·요약·인용. 원문 문장이 한 줄이라도 남는 글.
- 인스타·유튜브 계정 모니터링(쇼츠 레이더가 따로 있다), 자동 DM, 댓글 자동화.
- 새 화면. 기존 대시보드의 바이럴 예시 목록에 점수 칸 하나 보이는 정도까지만.
- DB 스키마 변경. 계정 통계는 `brandConfig` JSON, 글은 기존 `ViralExample`에 둔다.
- cosmicpath-global 적용. 국내에서 효과가 확인된 뒤 별도 판단.

**실패 조건 (작동해도 실패로 본다)**
- 발행된 `ref_replay` 글이 원문과 유사도 검사(`checkAntiRepeatSimilarity`)를 통과하지 못했는데 나간 것.
- 하루에 `ref_replay` 글이 2개 이상 생성되거나 발행된 것.
- 길이 실험의 시퀀스 위치(`sequencePosition`)나 판정 표본에 `ref_replay` 글이 들어간 것.
- 수집이 실패했는데 경보 없이 하루 넘게 지나간 것.
- 팔로워 많은 계정 글만 뽑히는 것(절대 수치 정렬). 모멘텀은 팔로워로 나눈 값이어야 한다.
- 권한 확인(0단계) 없이 구현을 시작해, 심사 미승인으로 전부 돌지 않는 것.

## 3. 설계

### 3.0 0단계: 권한 확인 (구현 전 게이트)

`profile_lookup`은 `threads_profile_discovery`, `profile_posts`·`keyword_search`는 Advanced Access가 있어야 다른 계정 글을 돌려준다. 심사 전에는 Meta 공식 계정만 조회된다.

- 확인 방법: 운영 토큰으로 `@the.saju`에 `profile_lookup`과 `profile_posts`를 한 번씩, `keyword_search?q=사주&search_type=TOP`을 한 번 호출한다. 기존 `viral.yml`을 `workflow_dispatch`로 수동 실행해 응답의 `errors`를 보는 것으로 대신해도 된다.
- 셋 다 데이터가 오면 구현 시작. 하나라도 권한 오류면 Meta 앱 심사(`threads_profile_discovery`, `threads_keyword_search`, `threads_basic` Advanced Access)가 선행 과제이고, 그건 사용자가 한다. 심사 중에는 이 설계의 나머지를 만들지 않는다.

### 3.1 참고 글 고르기 (대리 점수)

글 단위 반응 수가 없으므로 아래 네 신호를 더한 **참고 점수(referenceScore)**로 고른다. 각 신호의 가중치는 상수로 두고 이유를 주석에 남긴다. **[내 판단]**

| 신호 | 출처 | 뜻 | 점수 |
|---|---|---|---|
| 검색 신호 | `keyword_search` TOP (기존 `calculateSearchSignalScore`) | 우리 키워드로 TOP에 높이·여러 키워드에·여러 번 뜨는 글 | 기존 함수 그대로(최대 약 80) |
| 계정 모멘텀 | `profile_lookup` 7일 합계 | `views7d ÷ followerCount`. 팔로워 대비 이번 주 도달. **7일 이상 전** 스냅샷 대비 상승이면 가산(12시간 전 값과 비교하면 7일 창이 거의 겹쳐 노이즈다). 첫 7일은 가산 없음 | 상위 1/3 계정 +30, 상승 중 +10 |
| 답글 유무 | `profile_posts.has_replies` | 반응이 있었다는 유일한 글 단위 신호 | +10 |
| 구조 점수 | 기존 `calculateStructuralSignalScore` | 숫자·질문·대비 같은 훅 구조 | 기존 그대로 |

- 후보는 발행 7일 이내 글만. 재작성에 이미 쓴 글(`ref_replay_source:<id>` 태그)은 제외.
- **원본 자격은 계정 목록(`competitorHandles`)에 있는 계정의 글만.** 키워드 검색으로 들어온 목록 밖 계정 글은 저장하고 패턴 학습(`viralMemory`)에는 쓰되, 재작성 원본은 되지 않는다. 그래야 모멘텀 없는 글이 검색 신호만으로 1위가 되는 걸 막고, "목록을 비우면 생성이 멈춘다"는 종료 규칙이 성립한다. **[내 판단]**
- 하루 한 번, 참고 점수 1위 글이 그날의 원본이 된다. 점수가 동률이면 더 최근 글.
- 이 점수는 **추측**이다. 그래서 6장의 판정이 이 설계의 진짜 검증이고, 통과 못 하면 끈다.

### 3.2 수집

- **계정 목록**: `brandConfig.viralDiscovery.competitorHandles`. 수집기의 핸들 상한을 5 → 20으로 올린다. 초기값은 2026-10-22 조사 자료(`scratch/saju-astro-competitors-2026-10-22.json`, git 밖)에서 Threads 팔로워 1천 이상인 한국어 사주 계정 19개를 넣는다. 댄스 리포스트가 상위인 `_t.a.r.o_`는 뺀다. **[내 판단]** 상위: the.saju(4만), dohwadore_life_reader(3.3만), easy_saju(2.6만), forceteller_official(2.4만), wise.saying77(1.8만), saju.pharmacy(1.6만), saju.woorisai(1.4만), gold_pepper_(7천), saju_expert(5천), jaehwe365, pungsu_daddy, ilsang_saju, tianming.shaman, kozumo_room. 사용자는 설정 화면에서 언제든 바꾼다.
- **키워드**: `viralDiscovery.keywords` 5개(수집기 상한). 초기값 "사주", "궁합", "대운", "일주", "신년운세". **[내 판단]** 지금은 비어 있어서 브랜드 topics(긴 문장)가 키워드로 들어간다. 짧은 검색어로 바꿔야 TOP 결과가 의미 있다.
- **계정 통계**: 수집 때마다 핸들별 `profile_lookup`을 호출해 `{ followerCount, views7d, likes7d, reposts7d, capturedAt }`를 `brandConfig.viralDiscovery.accountStats[handle]`에 저장한다. 비교용 `previous`는 **7일 이상 지난 스냅샷 하나**만 남긴다: 현재 값이 저장될 때 기존 현재 값이 7일 이상 지났으면 그것을 `previous`로 내리고, 아니면 `previous`를 유지한다. 20계정 × 2회 = 하루 40회, 한도 1,000회의 4%. **[내 판단: 스키마 변경 없이 계정당 2개]**
- **글**: 기존 `ViralExample` 행(`brandId+source+sourceKey` 유니크)에 저장. `rawMetrics`에 `hasReplies, accountMomentum, referenceScore, timesSeen, searchRank, keywordHits`를 넣는다. `viralScore`는 그대로 두고 정렬·선택은 `referenceScore`로 한다.
- **주기**: `viral.yml` 스케줄을 하루 2회(UTC 0시·12시 = KST 9시·21시)로 되살린다. 매시간은 낭비다(글 반응은 첫 48시간에 붙는다). **[내 판단]**
- **대상 브랜드**: 핸들이나 키워드가 설정된 브랜드만. 지금은 cosmicpath 하나.
- **Claude 분석**(기존 `analyzeTopViralExamples`): 그 실행에서 새로 들어온 글 중 참고 점수 상위 5개만. 비용 상한.
- **경보**: 키워드·프로필 소스가 전부 실패하면(`externalAllFailed`) `sendSystemAlert(level: "error", title: "Viral discovery failed")`. 지금은 라우트가 500만 돌려줘서 GitHub Actions 로그에만 남는다.

### 3.3 구조 재작성 (`ref_replay`)

- 새 모드 `REFERENCE_REPLAY_MODE` (`id: "ref_replay"`). 기존 `WINNER_REPLAY_MODE`와 같은 지시문("참고 글의 구조만 따라 쓴다. 주제·문장·표현은 그대로 쓰지 않는다")에 한 줄을 더한다: "참고 글의 소재(인물·상황·사례)도 가져오지 않는다. 소재는 이번 글의 [주제]와 [타깃]에서만 가져온다." 원문이 남의 글이라 소재까지 막는다. **[내 판단]**
- 원본은 3.1의 1위 글. 기존 `experiment.winnerReference` 경로에 본문을 넣어 프롬프트에 "참고 글"로 보여주고, 저장 전 `checkAntiRepeatSimilarity(post, [{ content: reference }])`(기존 345행 경로)를 그대로 태운다. 걸리면 그 글은 버리고 그날은 생성하지 않는다. 재시도 없음.
- 출처는 `qualityReasons`에 `ref_replay_source:<ViralExample.id>` 태그로 남긴다(승자 재현의 `winner_replay_source:` 방식 그대로). 글 본문·첫 댓글에는 출처를 절대 쓰지 않는다.
- 길이: 실험 팔(S/L) 밖이므로 `lengthTarget`은 비운다. 대신 프롬프트에 "본문 140~260자" 규칙을 넣는다. 관찰 데이터 세 번 모두 짧은 글이 유리했고(최근 1.67배 [1.27, 3.11]), 실험 판정 전이라 강제가 아닌 목표치다. **[내 판단]**
- 소재·링크·첫 댓글·품질 게이트(읽히는 글 검사, 용어 상한, 지시문 유출 차단)는 기존 생성과 동일. 통과하면 `PENDING`, 못 하면 버린다. 사람 검토 없음.
- **하루 1개 상한과 생성 경로**: refill 크론 라우트에서 평소 배치(`generatePostsForBrand`, 큐 부족분 채우기)와 **별도 호출**로 만든다. 큐가 꽉 차 평소 배치가 0개(`backlog_full`)인 날에도 돈다. 이 글은 큐 부족을 채우는 글이 아니라 "하루 1개짜리 실험"이기 때문이다. 조건 두 개를 모두 만족할 때만 1개: (1) 오늘(KST) 만든 `ref_replay` 글이 0개, (2) **큐에 아직 발행 안 된 `ref_replay` 글이 0개**. (2) 덕분에 큐에 `ref_replay`가 둘 이상 나란히 서는 일이 없어, 발행 쪽 코드 없이도 같은 날 두 개가 나가지 않는다. 대시보드 수동 생성에서는 만들지 않는다(크론 전용). 호출은 평소 배치보다 **먼저** 하고 자체 시간 예산을 둔다(`MAX_REFILL_PER_RUN=6`은 `maxDuration 300s`에 맞춘 값이라 배치에 7번째를 얹지 않는다). **[내 판단]**
- 발행은 기존 `/api/cron/publish` 그대로. `pickPublishCandidate`가 비실험 글은 어느 슬롯에나 내보내므로 추가 코드가 없다. 하루 5슬롯 중 하나를 쓰는 건 받아들인다. **[사용자 결정: 실험 중 발행]**

### 3.4 길이 실험 보호

- `isExperimentPost`(`src/lib/length-experiment.ts`)에 `formulaId === "ref_replay"` 제외를 추가한다. 신년 모드(`ny_*`)를 같은 방식으로 뺀 전례가 있다.
- 판정 스크립트(`scripts/analyze-post-response.mjs`)의 제외 목록에도 `ref_replay`를 추가한다. 두 곳이 같은 규칙이어야 한다.
- `docs/experiments/2026-10-16-post-length.md`에 "2026-10-27부터 `ref_replay` 글은 실험 대상이 아니다(신년 글과 같은 처리)"를 한 줄 추가한다. 가설·지표·판정 기준은 그대로다.
- 테스트: 발행된 `ref_replay` 글이 있어도 `sequencePosition`이 변하지 않는다.

### 3.5 학습·추적

- `Post.formulaId = "ref_replay"`로 남으니 기존 학습(공식별 중앙값, Thompson 사전값)이 자동으로 이 공식을 하나의 팔로 본다. 추가 코드 없음.
- 어느 계정 구조가 옮겨 왔는지는 `ref_replay_source:` 태그 → `ViralExample.authorUsername`으로 역추적한다. 보고서는 기존 `analyze-post-response.mjs`의 formula 차원으로 충분하다.

### 3.6 화면

- 기존 대시보드 바이럴 예시 목록에 `referenceScore`와 계정 모멘텀 숫자를 칸 하나로 보인다. 시각 디자인 작업은 하지 않는다.

## 4. 제약

- 패키지 매니저 pnpm, 새 라이브러리 없음, `any` 금지.
- DB 스키마 변경 없음. 비밀값은 `.env.local`에만. 다른 계정 호출은 브랜드의 기존 Threads 토큰을 쓴다.
- 길이 실험 사전 등록(가설·지표·글 수·판정 기준)은 바꾸지 않는다. 3.4의 제외 규칙 추가만 한다.
- git push는 사용자 승인 후. 이 작업은 `feat/reference-replay` 브랜치(별도 워크트리).
- 다른 세션이 같은 저장소에서 `feat/multichannel-structure`(스키마 변경 포함)를 진행 중이다. 이 설계는 스키마를 건드리지 않아 충돌하지 않는다.

## 5. 재사용하는 것 (새로 만들지 않는다)

- 수집: `viral-harvester.ts`(키워드·프로필 어댑터, 중복 제거), `viral-service.ts`(저장·학습), `calculateSearchSignalScore`, `mergeStoredRawMetrics`(timesSeen 누적).
- 재작성: `WINNER_REPLAY_MODE`의 지시문과 `experiment.winnerReference` 프롬프트 경로, `checkAntiRepeatSimilarity`, `qualityReasons` 출처 태그.
- 게이트: 읽히는 글 검사, 용어 상한, 지시문 유출 차단, 품질 게이트 전부.
- 발행: `/api/cron/publish`, `pickPublishCandidate`의 비실험 글 통과.
- 운영: `viral.yml`, `verifyCronSecret`, `sendSystemAlert`.

## 6. 완료 기준과 종료 규칙

| 단계 | 끝났다고 보는 기준 |
|---|---|
| 0. 권한 | `profile_lookup`·`profile_posts`·`keyword_search` 셋 다 운영 토큰으로 데이터가 온다 |
| 1. 수집 | 하루 2회 수집이 연속 2일 돌고, 계정 20개의 `accountStats`와 `referenceScore`가 찍힌 `ViralExample` 행이 쌓인다. 실패 시 경보가 온다 |
| 2. 재작성 | `ref_replay` 글이 하루 ≤1개 `PENDING`에 들어가고, 유사도 검사 결과가 로그에 남는다. `sequencePosition` 불변 테스트 통과. `pnpm test`, `pnpm typecheck`, `pnpm build` 통과 |
| 3. 판정 | `ref_replay` 글 20개가 발행되고 3일 이상 측정된 뒤, 같은 기간 다른 글 대비 조회수 중앙값 배수를 `analyze-post-response.mjs`로 본다 |

**종료 규칙 [내 판단, 사용자가 바꿀 수 있음]**
- 배수의 95% CI 하한이 1.0 미만이면 **끈다**(`competitorHandles`를 비우면 생성이 멈춘다). 대리 점수가 틀렸다는 뜻이고, 그때는 유료 데이터 API를 다시 논의한다.
- 하한이 1.0 이상이면 유지. 중앙값 배수가 1.5 이상이면 하루 2개로 올릴지 사용자에게 묻는다.
- 20개 전에는 판정하지 않는다(중간 확인 금지, 길이 실험과 같은 이유).

## 7. 빌더에게 맡기는 것

- 참고 점수 상수의 정확한 값과 파일 위치(`viral-analysis.ts` 안 또는 새 파일).
- `accountStats`의 JSON 모양과 파싱 함수(`parseViralDiscoveryConfig` 확장).
- refill에서 "추가 1개"를 만드는 위치(배치 앞 또는 뒤)와 하루 상한을 세는 쿼리.
- `profile_lookup` 호출 함수 추가(`threads-api.ts`의 `fetchPublicProfilePosts` 옆).
- 대시보드 칸의 위치.

## 8. 빌더 체크에서 나온 질문과 결정 (2026-10-27)

빌더 역할 리뷰어가 낸 질문 4개. 모두 사용자 결정을 바꾸지 않아 설계자가 정했다.

| 질문 | 결정 | 반영 위치 |
|---|---|---|
| 큐가 꽉 찬 날(`backlog_full`)에도 만드나, 어느 경로에서 만드나 | 만든다. refill 크론에서 평소 배치와 별도 호출, 배치보다 먼저, 크론 전용 | 3.3 |
| 하루 2개 **발행** 방지에 발행 코드가 필요한가 | 필요 없다. "큐에 미발행 `ref_replay`가 0개일 때만 생성" 조건으로 큐에 둘이 나란히 서지 않게 한다 | 3.3 |
| 모멘텀 "상승" 비교 대상이 직전 주인가 직전 수집인가 | 7일 이상 전 스냅샷. 12시간 전과 비교하면 7일 창이 겹쳐 노이즈. 첫 7일은 가산 없음 | 3.1, 3.2 |
| 키워드 검색으로만 들어온 목록 밖 계정 글의 취급 | 저장·패턴 학습에는 쓰되 재작성 원본 자격은 목록 계정 글만 | 3.1 |
