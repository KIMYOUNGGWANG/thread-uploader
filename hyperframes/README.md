# HyperFrames 릴스 템플릿

`index.html` 하나에 `layout` 변수로 세 화면을 담았다 (6초 정지, 1080×1920, 사주 톤). 훅 유형은 쇼츠 레이더 416개 분석(2026-10-28)에서 상위 100개의 83%가 10초 이하 정지 리스트라서 고른 것이다.

| layout | 화면 | 쇼츠 상위 100 근거 |
|---|---|---|
| `rank` | 일간 TOP 5 | 출생연도·띠 리스트 90개 |
| `vs` | 양자택일 두 칸 | 21개 |
| `calendar` | 달마다 한 줄 | 17개, 채널 평균 25배 터진 1위 |

## 준비 (git에 없는 것)

```bash
cp -r ../video/public/reels assets/reels   # 배경 영상·BGM·한지 카드 (video/public/reels/README.md 참고)
curl -sL -o assets/fonts/PretendardVariable.woff2 \
  https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/packages/pretendard/dist/web/variable/woff2/PretendardVariable.woff2
```

## 렌더

```bash
npm run check
npx hyperframes@0.8.210 render --batch specs/batch.json -o "renders/{index}-{layout}.mp4"   # 6편 약 2분 30초
npx hyperframes@0.8.210 render --variables "$(cat specs/one.json)" -o renders/one.mp4        # 한 편
```

`specs/batch.json`의 항목 문구는 `"병화 — 짧은 문구"` 꼴. `vs`·`calendar`의 여러 항목은 `|`로 구분한다.
`--variables-file`은 0.8.210에서 깨져 있어(`io.readFile is not a function`) 인라인 JSON으로 넘긴다.
Node 22+, ffmpeg 필요. 명조는 Mac의 AppleMyungjo를 빌려 쓰므로 CI에서는 Noto Serif KR woff2를 `assets/fonts/`에 넣어야 같은 화면이 나온다.

## 올리기

렌더된 mp4는 기존 `video/scripts/queue-reels.mjs` manifest에 `file` 경로만 적어 Threads 승인 대기 큐에 넣는다.
