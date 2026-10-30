# kinetic-list 템플릿

cosmicpath 10초 세로 영상(1080×1920, 30fps). 사진 훅 + 흑요석·골드 키네틱 본문.
매일 원고(변수)만 바꿔 렌더한다. 기준 화면은 설계 문서 3장(`docs/superpowers/specs/2026-10-29-video-factory-1a-design.md`).

## 렌더

```bash
cd hyperframes/templates/kinetic-list
npx --yes hyperframes@0.8.210 check --json            # error 0 이어야 함
npx --yes hyperframes@0.8.210 render --strict-variables --variables '<json>' -o out.mp4
```

변수 JSON은 `src/lib/video-factory/render-variables.ts`의 `buildKineticListVariables(script, hookSrc)`가 만든다.

| id | 내용 |
|---|---|
| `hookSrc` | 훅 이미지/클립 경로. 없으면 `assets/img/hook-default.png` |
| `hookKind` | `image` 또는 `video` (`.mp4/.webm/.mov`면 video). 맞는 요소 하나만 남기고 나머지는 지운다 |
| `kicker`, `hook1`, `hook2` | 훅 키커(골드), 훅 2줄 |
| `intro1`, `intro2` | 도입 2줄 (2줄째 골드, 단어별 블러 인) |
| `g1..g3`, `l1..l3`, `a1a..a3b` | 항목별 한자, 이름, 행동 2줄 |
| `cta1`, `cta2` | 끝 문구 2줄 |

글자는 모두 y 288~1330px 띠 안에 있다. 항목 화면은 스파이크보다 20px 위(행동 2줄째 아래 끝 1314px).

## 에셋 (git에 커밋됨, CI가 그대로 씀)

| 파일 | 출처 | 라이선스 |
|---|---|---|
| `assets/fonts/PretendardVariable.woff2` | 메인 `hyperframes/assets/fonts/` | OFL 1.1 |
| `assets/fonts/NotoSerifKR-glyphs.woff2` | Google Fonts 서브셋 (아래 명령, 천간 10자만, 2.4KB) | OFL 1.1 |
| `assets/audio/bgm.m4a` | 메인 `hyperframes/assets/reels/bgm-ambient.m4a` (생성 모델 출력) | 자체 |
| `assets/img/hook-default.png` | 메인 `hyperframes/assets/reels/cards/saju-table.png` | 자체 |
| `assets/img/report-top.png` | 메인 `hyperframes/assets/report/sample-mobile.png` 위 1500px 크롭 (cosmicpath 리포트 캡처) | 자체 |

다시 만드는 명령 (레포 루트에서, `M`은 메인 체크아웃의 `hyperframes/assets`):

```bash
T=hyperframes/templates/kinetic-list/assets
cp "$M/fonts/PretendardVariable.woff2" $T/fonts/
cp "$M/reels/bgm-ambient.m4a" $T/audio/bgm.m4a
cp "$M/reels/cards/saju-table.png" $T/img/hook-default.png
ffmpeg -i "$M/report/sample-mobile.png" -vf crop=780:1500:0:0 $T/img/report-top.png

# Noto Serif KR 600 서브셋: 브라우저 User-Agent를 보내야 woff2 URL이 온다
UA='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
TEXT=$(python3 -c 'import urllib.parse;print(urllib.parse.quote("甲乙丙丁戊己庚辛壬癸"))')
curl -sSf -A "$UA" "https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@600&text=$TEXT" -o /tmp/noto.css
curl -sSf "$(grep -o 'https://fonts.gstatic.com[^)]*' /tmp/noto.css)" -o $T/fonts/NotoSerifKR-glyphs.woff2
```

폰트는 `url()` woff2만 쓴다(`local()` 금지). 맥과 CI(Linux) 화면이 같아야 해서다.
카운터(`JetBrains Mono`)와 `COSMICPATH`(`Playfair Display`)는 HyperFrames 번들 폰트라 이름만으로 같은 파일이 쓰인다.
한자는 Noto Serif KR이 em 박스 안에서 크고 낮게 앉아서 `.han`을 418px + `top:-64px; left:18px`로 맞췄다(스파이크 명조 440px와 글자 크기·위치 ±2px).

## 알려진 경고 (`check --json`, error 0)

- `nested_structure_needs_subcomposition` ×8 (lint): 장면을 `compositions/`로 나누지 않고 한 파일에 둬서 생긴다. 승인된 스파이크와 같은 구조이고 렌더 결과에는 영향이 없다. 장면을 Studio에서 따로 편집할 일이 생기면 나눈다.
- `line_unread` ×3 (craft): 끝 문구·`COSMICPATH`가 2초 미만(1.5~1.86초) 보인다. 설계 3장의 끝 구간이 8.0~10.0초(2초)이고 등장 애니메이션이 그 안에 있어서다. 길이 10초 고정이라 그대로 둔다.
- info: 훅 퇴장과 도입 등장이 0.15초 겹침(`content_overlap`), 폰 카드 안 리포트 이미지 스크롤(`container_overflow`). 의도된 연출.

## QC 기준값

스타일 샘플 원고로 렌더한 결과, 1초 간격 프레임 쌍(0-1 … 7-8초, 끝 2초 정지 제외)의 PSNR:

| 구간 | 0-1 | 1-2 | 2-3 | 3-4 | 4-5 | 5-6 | 6-7 | 7-8 |
|---|---|---|---|---|---|---|---|---|
| PSNR(dB) | 28.57 | 14.11 | 46.58 | 14.04 | 16.09 | 18.70 | 16.78 | 41.33 |

최댓값 46.58dB(2-3초, 도입 문구가 머무는 구간) → **`maxStillPsnr = 49.6`** (최댓값 + 3dB). 이보다 높은 쌍이 있으면 화면이 멈춘 것으로 본다.
