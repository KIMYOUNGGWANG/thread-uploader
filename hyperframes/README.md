# HyperFrames 릴스 실험

`video/`(Remotion)의 `IgRank10s`를 HyperFrames로 옮긴 실험판. 결과 비교는 2026-10-28 세션 기록 참고.

## 준비 (git에 없는 것)

```bash
cp -r ../video/public/reels assets/reels   # 배경 영상·BGM·한지 카드 (video/public/reels/README.md 참고)
curl -sL -o assets/fonts/PretendardVariable.woff2 \
  https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/packages/pretendard/dist/web/variable/woff2/PretendardVariable.woff2
```

## 렌더

```bash
npm run check
npx hyperframes@0.8.210 render --variables "$(cat specs/rank-sample.json)" -o renders/rank-sample.mp4
```

`--variables-file`은 0.8.210에서 깨져 있어(`io.readFile is not a function`) 인라인 JSON으로 넘긴다.
Node 22+, ffmpeg 필요. 명조는 Mac의 AppleMyungjo를 빌려 쓰므로 CI에서는 Noto Serif KR woff2를 `assets/fonts/`에 넣어야 같은 화면이 나온다.
