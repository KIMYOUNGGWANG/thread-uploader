# SNS 운영 비서 -- Phase 분리 계획

> 한 번에 다 만들면 복잡해져서 품질이 떨어집니다.
> Phase별로 나눠서 각각 "진짜 동작하는 제품"을 만듭니다.
> 각 Phase는 시작할 때 superpowers:brainstorming → writing-plans로 설계서·계획서를 따로 만든다 (`~/.claude/PIPELINE.md` 2단계).

---

## Phase 1a: 영상 공장 (MVP 전반)

### 목표
cosmicpath 영상이 하루 1편 이상 사람 손 없이 만들어지고, 대시보드에서 미리 볼 수 있다. 아직 업로드는 하지 않는다.

### 기능
- [ ] 영상 레퍼런스 통합 문서 `docs/design/video-references.md` (01_PRD 8장 목록 → 가져올 것·버릴 것·품질 기준)
- [ ] 브랜드 스타일 1개 확정: HyperFrames로 샘플 2~3개 → 사용자가 하나 고름 → 브랜드 템플릿으로 고정
- [ ] 클립 묶음: 무료 스톡(Pexels 등) 30~50개를 골라 `ClipAsset`에 등록 (라이선스 URL 기록)
- [ ] 원고 자동 작성: 포맷 2개 (`rank_static` BGM형 6~10초, `explain_narrated` 내레이션형 15~30초)
- [ ] 자동 렌더: HyperFrames 렌더를 CI(GitHub Actions)에서 돌림. 새 워크플로가 필요하다 (Node 22+, ffmpeg, 한글 폰트). 기존 `render-video.yml`은 Remotion·Node 20용이라 복제할 수 없다
- [ ] 기존 영상 경로 정리 **[내 판단]**: `src/app/api/cron/video-jobs/{next,complete}`(Remotion 렌더 → 완료 시 Threads `Post` 생성)는 지금처럼 꺼진 채 두고 건드리지 않는다. 새 경로는 Threads `Post`를 만들지 않는다
- [ ] 품질 검사: 글자 잘림·안전 영역·검은 화면·길이·움직임 (01_PRD 5장)
- [ ] 대시보드: 브랜드 페이지에서 완성 영상 미리보기 + 실패 이유

### 데이터
- `ClipAsset` (새로), `VideoDraft` 칸 추가 (02_DATA_MODEL)

### 인증
- 기존 대시보드 로그인 그대로

### 완료 기준
- 하루 1편 이상이 사람 손 없이 나온다.
- 사용자가 보고 "올릴 만하다"고 판정한 영상이 5편 연속이다.

### "진짜 제품" 체크리스트
- [ ] 실제 DB 연결 (목업 데이터 X)
- [ ] 실제 인증 (기존 로그인)
- [ ] 실제 서버에서 자동 실행 (내 맥에서 수동 렌더 X)
- [ ] 배포된 대시보드에서 영상 재생 가능

### Phase 1a 시작 프롬프트
```
이 PRD를 읽고 Phase 1a를 설계해주세요 (superpowers:brainstorming → writing-plans).
@PRD/01_PRD.md
@PRD/02_DATA_MODEL.md
@PRD/04_PROJECT_SPEC.md

Phase 1a 범위:
- 영상 레퍼런스 통합 문서
- cosmicpath 브랜드 스타일 확정 (샘플 2~3개 → 사용자 선택)
- 클립 묶음 (무료 스톡 30~50개)
- 원고 자동 작성 (포맷 2개)
- HyperFrames 자동 렌더 + 품질 검사
- 대시보드 미리보기

반드시 지켜야 할 것:
- 04_PROJECT_SPEC.md의 "절대 하지 마" 목록 준수
- Threads 발행·생성 로직은 건드리지 않음 (11/17 실험 동결)
- DB 스키마 변경은 설명 후 승인받고 진행
```

---

## Phase 1b: 3채널 업로드 (MVP 후반)

### 전제 조건
- Phase 1a 완료 기준 통과
- **자동 업로드는 11/17 Threads 글 길이 실험 판정 뒤에 켠다 [사용자 결정, 2026-10-29].** 그 전에는 업로드 코드를 만들고 수동 실행으로 테스트만 한다. 1a 자동 렌더는 지금 켜도 된다.

### 목표
완성 영상이 취소 창을 지나면 릴스·쇼츠에 공개, 틱톡에 비공개로 자동으로 올라간다.

### 기능
- [ ] 유튜브 쇼츠: 채널 연결(OAuth) + 업로드 (YouTube Data API `videos.insert`, 공식 문서 기준 하루 100회)
- [ ] 인스타 릴스: 재사용은 API 함수(`src/lib/instagram-api.ts`의 `createReelsContainer`·`getContainerStatus`·`publishContainer`)까지만 한다. `instagram-reels-sync.ts`는 `Post` 기반이라, 선점·중복 방지·재시도는 `Publication(videoDraftId)` 기준으로 새로 짠다 (기존 패턴을 참고)
- [ ] 틱톡: 채널 연결 + 업로드. 앱 심사 전에는 **비공개만 가능** (공식 문서). 심사 신청을 병행한다
- [ ] 취소 창: `autoPublishAt` 전에 취소 버튼으로 막기
- [ ] 채널별 캡션·해시태그
- [ ] 실패 재시도와 중복 업로드 방지 (인스타 쪽 기존 패턴 재사용)

### 추가 데이터
- `Publication.videoDraftId`, `ChannelAccount`에 youtube·tiktok 줄

### 완료 기준
- 7일 연속 릴스·쇼츠가 자동으로 공개되고, 틱톡은 비공개로 올라간다.

### 통합 테스트
- Threads 자동 발행이 여전히 정상인지 확인

---

## Phase 2: 아침 보고판

### 전제 조건
- Phase 1b 안정 운영

### 목표
대시보드 첫 화면 하나로 "잘 올라갔나 / 남은 것 / 내 할 일"을 안다.

### 기능
- [ ] 첫 화면 보고판: 어제~지금 업로드 결과 (채널별 성공·실패와 이유), 오늘 대기 (자동 업로드까지 남은 시간 + 취소 버튼), 내 할 일 (틱톡 공개 전환, 토큰 만료, 클립 부족 등)
- [ ] 채널별 조회수 수집 (Publication.views)
- [ ] 다른 브랜드로 확장 (cosmicpath-global 등)

### 디자인
- 화면 작업이라 `~/.claude/PIPELINE.md` 3단계(brand-web-design → taste-skill)를 탄다.

---

## Phase 3: 카드뉴스 (인스타 캐러셀)

- [ ] 원고 → 이미지 여러 장 렌더 (HyperFrames 정지 프레임 또는 HTML 캡처)
- [ ] 인스타 캐러셀 업로드
- 설계는 Phase 3 시작 때 따로 한다.

## Phase 4: X

- [ ] X 계정 연결 + 글·이미지 업로드
- 주의: X API는 유료 플랜이 필요할 수 있다. 시작 전에 비용 확인.

---

## 고도화 (조건이 되면)

| 조건 | 할 일 |
|---|---|
| Higgsfield 크레딧 충전 | 브랜드 전용 AI 클립을 한 번에 만들어 `ClipAsset(source=ai)`으로 스톡을 교체 |
| 틱톡 앱 심사 통과 | 틱톡 공개 업로드로 전환 |
| 채널별 성과 데이터 쌓임 | 성과 좋은 포맷을 더 자주 쓰기 (기존 Thompson 학습 재사용 검토) |

### 주의사항
- 비용: AI 클립 생성, X API, 비평 단계(LLM 비전)는 돈이 든다. 켤 때마다 사용자에게 확인한다.

---

## Phase 로드맵 요약

| Phase | 핵심 기능 | 상태 |
|-------|----------|------|
| 1a | 영상 공장 (원고·클립·렌더·검사·미리보기) | 시작 전 |
| 1b | 릴스·쇼츠 공개 + 틱톡 비공개 업로드, 취소 창 | 1a 완료 후 |
| 2 | 아침 보고판, 성과 수집, 브랜드 확장 | 1b 완료 후 |
| 3 | 카드뉴스 | 2 완료 후 |
| 4 | X | 3 완료 후 |
