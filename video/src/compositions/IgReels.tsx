// IgReels.tsx — Instagram Reels 9:16 compositions (ig_rank_10s, ig_pickcard_16s).
// Same VideoBase timeline as Shorts/TikTokExplainer; the rank-card / pick-card
// scene components draw the whole frame, so captions are "none" and audio is empty.
// The sample specs below are the Studio previews and the render smoke-test inputs.
import { VideoBase } from "../components/VideoBase";
import { ReelsFrame, REELS_BGM } from "../components/ReelsFrame";
import { PLACEHOLDER_RENDER_SPEC, type RenderSpec } from "../render-spec";

// ReelsFrame이 배경 영상·그라데이션·하단 브랜드를 그리고, VideoBase는 그 위에 투명하게 얹힌다.
export const IgReels: React.FC<RenderSpec> = (props) => (
  <ReelsFrame>
    <VideoBase {...props} background={{ type: "color", src: "transparent" }} />
  </ReelsFrame>
);

const IG_BASE_SPEC: Omit<RenderSpec, "composition" | "durationInFrames" | "scenes"> = {
  ...PLACEHOLDER_RENDER_SPEC,
  captions: { ...PLACEHOLDER_RENDER_SPEC.captions, style: "none" },
  background: { type: "color", src: "transparent" },
  audio: { music: REELS_BGM, musicGainDb: -18 },
};

export const IG_RANK_SAMPLE_SPEC: RenderSpec = {
  ...IG_BASE_SPEC,
  composition: "IgRank10s",
  durationInFrames: 300,
  scenes: [
    {
      id: "scene-01-rank",
      fromFrame: 0,
      durationInFrames: 300,
      visual: {
        type: "rank-card",
        src: "rank-card",
        kenBurns: false,
        cardData: {
          title: "2027년 운 좋은 일간 TOP 5",
          items: [
            "병화 — 귀인이 먼저 손 내미는 해",
            "임수 — 막혔던 재물 흐름이 풀림",
            "기토 — 이직·승진 타이밍이 옴",
            "신금 — 인연이 들어오는 해",
            "을목 — 쉬어가며 기반을 다지는 해",
          ],
        },
      },
      onScreenText: [],
    },
  ],
};

export const IG_PICKCARD_SAMPLE_SPEC: RenderSpec = {
  ...IG_BASE_SPEC,
  composition: "IgPickCard16s",
  durationInFrames: 480,
  scenes: [
    {
      id: "scene-01-pick",
      fromFrame: 0,
      durationInFrames: 480,
      visual: {
        type: "pick-card",
        src: "pick-card",
        kenBurns: false,
        cardData: {
          question: "A/B/C 중 끌리는 카드 하나, 당신의 11월",
          cards: [
            { label: "A", text: "흐름을 바꾸는 선택이 온다" },
            { label: "B", text: "기다리던 인연이 먼저 연락한다" },
            { label: "C", text: "작게 쌓이던 재물이 눈에 보인다" },
          ],
          cta: "저장해 두고 A/B/C 중 하나 골라 댓글",
          ctaAtSeconds: 12,
        },
      },
      onScreenText: [],
    },
  ],
};
