# 릴스 템플릿 공유 에셋

생성 모델 출력이라 git에 넣지 않아. 없으면 아래 프롬프트로 다시 만들고 같은 이름으로 둬.

- `bg-cosmic.mp4` — 1080x1920, 10초, 무음. Higgsfield Kling 3.0 Turbo 9:16 5초를 ffmpeg로 앞뒤 핑퐁 이어붙임.
  프롬프트: "Slow drifting deep-space nebula, dark navy and indigo clouds with faint violet and amber glow, tiny stars twinkling, very slow camera drift, no text, no people, no planets, seamless ambient loop, cinematic, calm, high contrast dark background"
  후처리: `ffmpeg -i raw.mp4 -filter_complex "[0:v]scale=1080:1920,split[a][b];[b]reverse[r];[a][r]concat=n=2:v=1:a=0,format=yuv420p[out]" -map "[out]" -an -c:v libx264 -crf 20 bg-cosmic.mp4`
- `bgm-ambient.m4a` — 16초. Higgsfield Sonilo Music.
  프롬프트: "Calm ambient pad, soft warm synth drone with gentle slow arpeggio, mystical night sky mood, no drums, no vocals, slow tempo, loopable, subtle, for a short-form fortune reel"

## 렌더 명령

릴스 렌더는 캐시를 끈다(`--bundle-cache=false`). 주의: zsh에서는 `set -- $pair`처럼 변수를 공백으로 쪼개지 않는다. 반복문으로 돌릴 때는 함수 인자로 넘겨. 2026-10-23에 이걸 몰라서 빈 props로 렌더돼 옛 화면이 나왔어.

```bash
npx remotion render src/index.ts IgRank10s out/reels/<이름>.mp4 --props=<spec.json> --bundle-cache=false
npx remotion render src/index.ts IgPickCard16s out/reels/<이름>.mp4 --props=<spec.json> --bundle-cache=false
```

spec.json의 `audio`는 `{ "music": "reels/bgm-ambient.m4a", "musicGainDb": -18 }`, `background`는 `{ "type": "color", "src": "transparent" }`로 둔다. 배경 영상은 `ReelsFrame`이 그린다.

## 촬영본 모드 (카드 선택)

촬영 컷 구성은 `docs/design/reels-shot-list.md`. 촬영본은 `footage/` 아래에 두고(git 제외), spec에서
`background: { "type": "video", "src": "reels/footage/ep02.mp4" }`, `cardData.filmed: true`, `cardData.reveals: [{ label, text, atSeconds }]`를 준다.
`footage/test.mp4`는 자막 배치 확인용 가짜 촬영본(카드 자리 회색 사각형 3개)이야.

## 랭킹 정지

spec의 `durationInFrames`를 180(6초)으로 둔다. 등장 애니메이션이 없어서 첫 프레임부터 전부 보이고, 짧게 반복 재생된다.

## 카드 뒤집기 (A안, 촬영 없이)

`cards/`의 이미지 5장과 효과음 1개를 Remotion `FlipCards`가 3D로 뒤집는다. 전부 생성 모델 출력이라 git에 넣지 않아.
스펙: `background: { "type": "image", "src": "reels/cards/table.png" }`, `cardData.filmed: true`,
`cardData.cardImages: { back, fronts: [a, b, c], flipSound }`, 뒤집는 시점은 `cardData.reveals[].atSeconds`.

Higgsfield GPT Image 2.5, `--quality medium --resolution 1k` (장당 0.5크레딧). 카드는 2:3, 테이블은 9:16.
공통 꼬리말 NO = "flat front-facing view, the card fills the entire frame edge to edge, no text, no letters, no numbers, no watermark, no table, no hands, no shadow"

- `back.png`: "Tarot card back design, deep midnight navy with fine gold celestial line art, central crescent moon inside a circle of small stars, symmetrical ornamental pattern, thin gold double border, " + NO
- `front-a.png`: "Tarot-style card face illustration, a glowing crescent moon above calm dark water with its reflection, deep indigo and soft gold palette, painterly mystical style, thin gold border, " + NO
- `front-b.png`: "Tarot-style card face illustration, a warm sun rising between two mountains with rays of light, amber and gold palette on deep navy, painterly mystical style, thin gold border, " + NO
- `front-c.png`: "Tarot-style card face illustration, a single bright eight-pointed star above a winding path leading forward, teal and gold palette on deep navy, painterly mystical style, thin gold border, " + NO
- `table.png`: "Top-down photo of dark navy velvet cloth on a table, soft warm spotlight from above making a gentle pool of light in the middle, subtle fabric texture, a few tiny scattered gold star confetti near the edges only, empty center, no cards, no objects, no text, moody cinematic, vertical composition"
- `flip.mp3`: Seed Audio "Single crisp playing card flip sound effect, a thick tarot card being turned over on velvet, short soft swish followed by a light tap, close-up foley, no music, no voice, under one second" → ffmpeg로 앞 무음 제거, 1초로 자름.

주의: 카드 3D 회전 요소의 부모에 opacity를 걸면 Chrome이 카드를 빼먹는 프레임이 생겼다(2026-10-23). 앞뒷면을 겹치지 말고 90도에서 이미지를 바꿔 끼운다.

### 사주 톤으로 교체 (2026-10-23)

별·달·해 타로 카드가 "너무 타로 같다"는 판정을 받아 교체했어. 지금 쓰는 건 아래 두 장 + CSS다. 타로 카드 이미지(back, front-a~c, table)는 안 쓴다.

- `saju-front.png`: "Blank card made of cream Korean hanji mulberry paper with visible soft fibers, thin vermilion red double border line, a small vermilion square seal stamp with an abstract geometric pattern in the bottom right corner, large empty space in the center, " + NO
- `saju-table.png`: "Top-down photo of a dark walnut wooden table surface with fine wood grain, soft warm lamp light from above making a gentle pool of light in the center, a Korean calligraphy brush and an ink stone resting only in the top-left corner, empty center, no cards, no text, moody cinematic, vertical composition"
- 뒷면: 이미지 없이 `FlipCards`의 `LacquerBack`(옻칠 바탕·오방색 띠·命)을 CSS로 그린다.
- 앞면 글자: `cardImages.marks: [{ hanja, word }]`. 한자는 명조(AppleMyungjo, macOS 로컬 전용). CI에서 렌더하면 Noto Serif CJK로 떨어지니 폰트를 확인해.

랭킹(`RankCard`)도 `saju-front.png`를 한지 패널로, `saju-table.png`를 배경(`background: { type: "image" }`)으로 재사용한다. 새 이미지는 없다.
