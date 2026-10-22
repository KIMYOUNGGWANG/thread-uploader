# 릴스 템플릿 공유 에셋

생성 모델 출력이라 git에 넣지 않아. 없으면 아래 프롬프트로 다시 만들고 같은 이름으로 둬.

- `bg-cosmic.mp4` — 1080x1920, 10초, 무음. Higgsfield Kling 3.0 Turbo 9:16 5초를 ffmpeg로 앞뒤 핑퐁 이어붙임.
  프롬프트: "Slow drifting deep-space nebula, dark navy and indigo clouds with faint violet and amber glow, tiny stars twinkling, very slow camera drift, no text, no people, no planets, seamless ambient loop, cinematic, calm, high contrast dark background"
  후처리: `ffmpeg -i raw.mp4 -filter_complex "[0:v]scale=1080:1920,split[a][b];[b]reverse[r];[a][r]concat=n=2:v=1:a=0,format=yuv420p[out]" -map "[out]" -an -c:v libx264 -crf 20 bg-cosmic.mp4`
- `bgm-ambient.m4a` — 16초. Higgsfield Sonilo Music.
  프롬프트: "Calm ambient pad, soft warm synth drone with gentle slow arpeggio, mystical night sky mood, no drums, no vocals, slow tempo, loopable, subtle, for a short-form fortune reel"

## 렌더 명령

Remotion webpack 캐시가 컴포넌트 수정을 못 잡는 경우가 있어서(2026-10-23 확인) 릴스 렌더는 항상 캐시를 끈다.

```bash
npx remotion render src/index.ts IgRank10s out/reels/<이름>.mp4 --props=<spec.json> --bundle-cache=false
npx remotion render src/index.ts IgPickCard16s out/reels/<이름>.mp4 --props=<spec.json> --bundle-cache=false
```

spec.json의 `audio`는 `{ "music": "reels/bgm-ambient.m4a", "musicGainDb": -18 }`, `background`는 `{ "type": "color", "src": "transparent" }`로 둔다. 배경 영상은 `ReelsFrame`이 그린다.
