// PromoViral.tsx — 45s 9:16 motion-graphics promo for CosmicPath (KO/EN).
// Silent by design: the trending sound is added on-platform at upload time.
// Copy rules (cosmicpath docs/product.md): no fabricated scores/percentages,
// no "판정/직답/권고", price only from the $9.99 reading label. The match
// (궁합) funnel is Korean-only, so the EN cut swaps that scene for /review.
import React from "react";
import {
  AbsoluteFill,
  Easing,
  Sequence,
  interpolate,
  useCurrentFrame,
} from "remotion";
import { ensurePretendard } from "../load-fonts";
import data from "../data/promo-report-data.json";
import { FlowTourScene, HeatmapTourScene, SajuTourScene, TourKicker, TOUR_TOTAL, ZiweiTourScene } from "../components/PromoReportTour";
import { C, Rise, Starfield, textBase, useEnter, useExit, type PromoLang } from "../components/PromoKit";

void ensurePretendard();

export type PromoViralProps = { lang: PromoLang };

export const PROMO_FPS = 30;
export const PROMO_DURATION = 1350;


type ReportCard = { title: string; body: string; tone?: "danger" };

type Copy = {
  hook: [string, string, string];
  painTitle: string;
  pains: [string, string, string];
  engineTop: string;
  engineBottom: string;
  engines: string[];
  timeFix: string;
  questionLabel: string;
  persona: string;
  question: string;
  reportTag: string;
  reportTitle: string;
  sample: string;
  forkA: string;
  forkB: string;
  cards: ReportCard[];
  callouts: string[];
  pairTitle: string;
  pairLeft: [string, string];
  pairRight: [string, string];
  pairResult: string;
  pairHook: string;
  outro: [string, string];
  cta: string;
  price: string;
  disclaimer: string;
};

const COPY: Record<PromoLang, Copy> = {
  ko: {
    hook: ["운세 앱이 말했다", "“좋은 흐름이 오고 있어요”", "그래서… 뭘 하라는 건데?"],
    painTitle: "결정 앞에서 쓸모없던 이유",
    pains: ["누구에게나 맞는 두루뭉술한 위로", "동경시 그대로 쓴 30분 시차", "계산 없이 지어낸 AI 운세"],
    engineTop: "계산 엔진 5개가 먼저 계산하고",
    engineBottom: "AI는 해석만 해요",
    engines: ["사주", "서양 점성술", "자미두수", "태국 점성술", "수비학"],
    timeFix: "출생 도시 기준 시간 보정",
    questionLabel: "질문은 딱 하나",
    persona: "가상 인물 · 1996.03.14 10:30 · 서울",
    question: "이직할까, 버틸까?",
    reportTag: "유료 리포트",
    reportTitle: "7일 결정 패킷",
    sample: "예시 화면",
    forkA: "지금 이직 준비 시작",
    forkB: "6개월 버티며 성과 쌓기",
    cards: [
      { title: "언제", body: `첫 실행 적합 구간: ${data.scenario.ko.peakLabel ?? ""}` },
      { title: "7일 실험", body: "Day 1 지원서 1곳 → Day 7 반응 기록" },
      { title: "조건: if / then", body: "면접 제안이 오면 → 움직임\n반응이 없으면 → 기준 재점검" },
      { title: "접을 신호", body: "불안이 기대보다 커지면 멈춤", tone: "danger" },
    ],
    callouts: ["언제 움직일지", "7일 동안 뭘 해볼지", "어떤 조건이면 갈지", "언제 접을지"],
    pairTitle: "고민이 '우리'라면",
    pairLeft: ["나", "1996. 03. 14"],
    pairRight: ["너", "1997. 08. 02"],
    pairResult: "궁합 Decision Note",
    pairHook: "“이거 너랑 나 돌려볼까?”",
    outro: ["대신 결정해주지 않아요", "결정할 기준을 줘요"],
    cta: "무료 진단부터 시작",
    price: "7일 결정 패킷 $9.99",
    disclaimer: "사주·점성 해석은 참고용이며, 최종 결정은 본인의 판단입니다",
  },
  en: {
    hook: ["Your horoscope said", "“Good things are coming.”", "…okay, but what do I DO?"],
    painTitle: "Why it never helped you decide",
    pains: ["Vague comfort that fits anyone", "Birth time off by 30 minutes", "AI fortunes with zero math"],
    engineTop: "5 calculation engines do the math",
    engineBottom: "AI only interprets",
    engines: ["Saju", "Western", "Zi Wei", "Thai", "Numerology"],
    timeFix: "Birth-city time correction",
    questionLabel: "Ask one question",
    persona: "Fictional sample · Mar 14, 1996 10:30 · Seoul",
    question: "Quit my job, or stay?",
    reportTag: "Paid report",
    reportTitle: "7-Day Decision Packet",
    sample: "Sample screen",
    forkA: "Start job hunting now",
    forkB: "Stay 6 months, build results",
    cards: [
      { title: "When", body: `First-move window: ${data.scenario.en.peakLabel ?? ""}` },
      { title: "7-day experiment", body: "Day 1 apply to one role → Day 7 log replies" },
      { title: "If / then rules", body: "Interview offer → move\nNo replies → recheck criteria" },
      { title: "Stop rule", body: "Anxiety outweighs upside → pause", tone: "danger" },
    ],
    callouts: ["When to move", "What to test for 7 days", "Which conditions say go", "When to walk away"],
    pairTitle: "Then, 7 days later",
    pairLeft: ["Day 1", "Your plan"],
    pairRight: ["Day 7", "What happened"],
    pairResult: "Decision Review",
    pairHook: "Your call, checked against reality.",
    outro: ["We don't decide for you.", "We give you the criteria."],
    cta: "Start with a free reading",
    price: "7-Day Decision Packet $9.99",
    disclaimer: "For reference only. The final decision is yours.",
  },
};

// Scene timeline in frames (30 fps). Sums to PROMO_DURATION.
const SCENES = [
  { id: "hook", from: 0, len: 90 },
  { id: "pains", from: 90, len: 105 },
  { id: "engines", from: 195, len: 120 },
  { id: "question", from: 315, len: 75 },
  { id: "saju", from: 390, len: 120 },
  { id: "flow", from: 510, len: 150 },
  { id: "heatmap", from: 660, len: 120 },
  { id: "ziwei", from: 780, len: 120 },
  { id: "report", from: 900, len: 225 },
  { id: "pair", from: 1125, len: 105 },
  { id: "outro", from: 1230, len: 120 },
] as const;


// ── Scene 1: hook ────────────────────────────────────────────────────────────
const HookScene: React.FC<{ copy: Copy; len: number }> = ({ copy, len }) => {
  const frame = useCurrentFrame();
  const out = useExit(len);
  const punch = useEnter(52, 9);
  const shake = frame > 52 && frame < 64 ? Math.sin(frame * 3) * 8 : 0;
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", opacity: out, padding: 80 }}>
      <Rise delay={0}>
        <div style={{ ...textBase, fontSize: 52, color: C.dim, fontWeight: 600 }}>{copy.hook[0]}</div>
      </Rise>
      <Rise delay={10} style={{ marginTop: 28 }}>
        <div style={{ ...textBase, fontSize: 76, fontWeight: 800, opacity: interpolate(frame, [48, 58], [1, 0.35], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }}>
          {copy.hook[1]}
        </div>
      </Rise>
      <div
        style={{
          ...textBase,
          marginTop: 90,
          fontSize: 92,
          fontWeight: 900,
          color: C.goldHi,
          opacity: punch,
          transform: `scale(${0.6 + punch * 0.4}) translateX(${shake}px)`,
        }}
      >
        {copy.hook[2]}
      </div>
    </AbsoluteFill>
  );
};

// ── Scene 2: pains, struck through ──────────────────────────────────────────
const PainRow: React.FC<{ label: string; index: number }> = ({ label, index }) => {
  const frame = useCurrentFrame();
  const enter = useEnter(12 + index * 12);
  const strike = interpolate(frame, [56 + index * 6, 68 + index * 6], [0, 100], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  return (
    <div
      style={{
        position: "relative",
        margin: "18px 0",
        padding: "34px 40px",
        borderRadius: 28,
        background: C.card,
        border: `2px solid ${C.border}`,
        opacity: enter,
        transform: `translateX(${(1 - enter) * (index % 2 ? 300 : -300)}px)`,
      }}
    >
      <div style={{ ...textBase, fontSize: 50, fontWeight: 700, color: strike > 50 ? C.dim : C.text }}>{label}</div>
      <div
        style={{
          position: "absolute",
          left: 30,
          top: "50%",
          height: 8,
          borderRadius: 4,
          width: `calc(${strike}% - 60px)`,
          background: C.rose,
        }}
      />
    </div>
  );
};

const PainsScene: React.FC<{ copy: Copy; len: number }> = ({ copy, len }) => (
  <AbsoluteFill style={{ justifyContent: "center", padding: 80, opacity: useExit(len) }}>
    <Rise>
      <div style={{ ...textBase, fontSize: 60, fontWeight: 800, marginBottom: 40 }}>{copy.painTitle}</div>
    </Rise>
    {copy.pains.map((p, i) => (
      <PainRow key={p} label={p} index={i} />
    ))}
  </AbsoluteFill>
);

// ── Scene 3: five engines orbiting ──────────────────────────────────────────
const ENGINE_COLORS = [C.gold, C.indigo, C.emerald, C.rose, C.goldHi];

const EngineNode: React.FC<{ label: string; index: number; total: number }> = ({ label, index, total }) => {
  const frame = useCurrentFrame();
  const enter = useEnter(8 + index * 7);
  const angle = (index / total) * Math.PI * 2 - Math.PI / 2 + frame / 140;
  const radius = 330 * enter;
  const color = ENGINE_COLORS[index % ENGINE_COLORS.length];
  return (
    <div
      style={{
        position: "absolute",
        left: 540 + Math.cos(angle) * radius,
        top: 860 + Math.sin(angle) * radius,
        transform: "translate(-50%, -50%)",
        padding: "20px 30px",
        borderRadius: 999,
        background: C.card,
        border: `3px solid ${color}`,
        boxShadow: `0 0 40px ${color}55`,
        opacity: enter,
        ...textBase,
        fontSize: 40,
        fontWeight: 700,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </div>
  );
};

const EnginesScene: React.FC<{ copy: Copy; len: number }> = ({ copy, len }) => {
  const frame = useCurrentFrame();
  const core = useEnter(0, 10);
  const pulse = 1 + Math.sin(frame / 8) * 0.04;
  const badge = useEnter(70);
  return (
    <AbsoluteFill style={{ opacity: useExit(len) }}>
      <Rise delay={0} style={{ position: "absolute", top: 230, width: "100%" }}>
        <div style={{ ...textBase, fontSize: 60, fontWeight: 800 }}>{copy.engineTop}</div>
      </Rise>
      <div
        style={{
          position: "absolute",
          left: 540,
          top: 860,
          width: 230,
          height: 230,
          borderRadius: 999,
          transform: `translate(-50%, -50%) scale(${core * pulse})`,
          background: `radial-gradient(circle, ${C.goldHi}, ${C.gold} 55%, transparent 72%)`,
          boxShadow: `0 0 120px ${C.gold}88`,
        }}
      />
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        <circle cx={540} cy={860} r={330} fill="none" stroke={C.gold} strokeOpacity={0.3 * core} strokeWidth={2} strokeDasharray="8 14" />
      </svg>
      {copy.engines.map((e, i) => (
        <EngineNode key={e} label={e} index={i} total={copy.engines.length} />
      ))}
      <div style={{ position: "absolute", top: 1330, width: "100%", opacity: badge, transform: `translateY(${(1 - badge) * 40}px)` }}>
        <div style={{ ...textBase, fontSize: 64, fontWeight: 900, color: C.goldHi }}>{copy.engineBottom}</div>
        <div style={{ display: "flex", justifyContent: "center", marginTop: 40 }}>
          <div style={{ ...textBase, fontSize: 36, fontWeight: 600, padding: "14px 30px", borderRadius: 999, border: `2px solid ${C.gold}`, color: C.gold }}>
            + {copy.timeFix}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ── Scene 4: one question, typed ────────────────────────────────────────────
const QuestionScene: React.FC<{ copy: Copy; len: number }> = ({ copy, len }) => {
  const frame = useCurrentFrame();
  const chars = Math.floor(interpolate(frame, [12, 45], [0, copy.question.length], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));
  const caret = Math.floor(frame / 8) % 2 === 0 ? 1 : 0;
  return (
    <AbsoluteFill style={{ justifyContent: "center", padding: 80, opacity: useExit(len, 8) }}>
      <Rise>
        <div style={{ ...textBase, fontSize: 48, color: C.dim, fontWeight: 600, marginBottom: 40 }}>{copy.questionLabel}</div>
      </Rise>
      <Rise delay={4}>
        <div style={{ padding: "48px 40px", borderRadius: 36, background: C.card, border: `3px solid ${C.gold}`, boxShadow: `0 0 80px ${C.gold}33` }}>
          <div style={{ ...textBase, fontSize: 76, fontWeight: 800, minHeight: 100 }}>
            {copy.question.slice(0, chars)}
            <span style={{ opacity: caret, color: C.goldHi }}>|</span>
          </div>
        </div>
      </Rise>
      <Rise delay={30} style={{ marginTop: 36 }}>
        <div style={{ ...textBase, fontSize: 34, color: C.dim }}>{copy.persona}</div>
      </Rise>
    </AbsoluteFill>
  );
};

// ── Scene 5: the paid report inside a phone ─────────────────────────────────
const CALLOUT_START = 40;
const CALLOUT_STEP = 45;

function activeCallout(frame: number, count: number): number {
  if (frame < CALLOUT_START) return -1;
  return Math.min(count - 1, Math.floor((frame - CALLOUT_START) / CALLOUT_STEP));
}

const PacketCard: React.FC<{ card: ReportCard; index: number; active: boolean }> = ({ card, index, active }) => {
  const enter = useEnter(14 + index * 6);
  const accent = card.tone === "danger" ? C.rose : C.goldHi;
  return (
    <div
      style={{
        marginTop: 26,
        padding: "34px 34px",
        borderRadius: 24,
        background: active ? "rgba(200,168,77,0.10)" : "rgba(255,255,255,0.03)",
        border: `3px solid ${active ? accent : C.border}`,
        boxShadow: active ? `0 0 50px ${accent}55` : "none",
        transform: `scale(${active ? 1.04 : 1}) translateY(${(1 - enter) * 40}px)`,
        opacity: enter,
      }}
    >
      <div style={{ ...textBase, textAlign: "left", fontSize: 42, fontWeight: 800, color: card.tone === "danger" ? "#fda4af" : C.text }}>
        {card.title}
      </div>
      <div style={{ ...textBase, textAlign: "left", fontSize: 36, color: C.dim, marginTop: 12, whiteSpace: "pre-line", lineHeight: 1.4 }}>
        {card.body}
      </div>
    </div>
  );
};

const ForkRow: React.FC<{ copy: Copy }> = ({ copy }) => (
  <div style={{ marginTop: 30, padding: "30px 34px", borderRadius: 24, border: `2px solid ${C.border}`, background: "rgba(255,255,255,0.02)" }}>
    <div style={{ ...textBase, textAlign: "left", fontSize: 36, fontWeight: 600 }}>
      <span style={{ color: C.goldHi, fontWeight: 800 }}>A · </span>
      {copy.forkA}
    </div>
    <div style={{ ...textBase, textAlign: "left", fontSize: 36, fontWeight: 600, marginTop: 12 }}>
      <span style={{ color: C.dim, fontWeight: 800 }}>B · </span>
      {copy.forkB}
    </div>
  </div>
);

const Phone: React.FC<{ copy: Copy; active: number }> = ({ copy, active }) => {
  const frame = useCurrentFrame();
  const scroll = interpolate(frame, [60, 200], [0, -110], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.cubic) });
  return (
    <div style={{ width: 800, height: 1360, borderRadius: 70, padding: 22, background: "#1c1915", border: `3px solid ${C.gold}66`, boxShadow: `0 40px 140px rgba(0,0,0,0.8), 0 0 90px ${C.gold}22` }}>
      <div style={{ width: "100%", height: "100%", borderRadius: 52, overflow: "hidden", background: C.bg, position: "relative" }}>
        <div style={{ padding: "60px 40px", transform: `translateY(${scroll}px)` }}>
          <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
            <span style={{ ...textBase, fontSize: 28, fontWeight: 700, color: C.bg, background: C.goldHi, padding: "10px 22px", borderRadius: 999 }}>{copy.reportTag}</span>
            <span style={{ ...textBase, fontSize: 28, color: C.dim }}>{copy.sample}</span>
          </div>
          <div style={{ ...textBase, textAlign: "left", fontSize: copy.reportTitle.length > 12 ? 50 : 66, whiteSpace: "nowrap", fontWeight: 900, marginTop: 28, color: C.goldHi }}>{copy.reportTitle}</div>
          <div style={{ ...textBase, textAlign: "left", fontSize: 38, color: C.dim, marginTop: 10 }}>{copy.question}</div>
          <ForkRow copy={copy} />
          {copy.cards.map((card, i) => (
            <PacketCard key={card.title} card={card} index={i} active={i === active} />
          ))}
        </div>
      </div>
    </div>
  );
};

const ReportScene: React.FC<SceneProps> = ({ copy, lang, len }) => {
  const frame = useCurrentFrame();
  const phoneIn = useEnter(0, 16);
  const active = activeCallout(frame, copy.callouts.length);
  const calloutLocal = frame - CALLOUT_START - active * CALLOUT_STEP;
  const pop = active < 0 ? 0 : interpolate(calloutLocal, [0, 8], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ opacity: useExit(len) }}>
      <TourKicker lang={lang} index={TOUR_TOTAL} />
      <div style={{ position: "absolute", top: 170, width: "100%", height: 140, display: "flex", justifyContent: "center", alignItems: "center" }}>
        {active >= 0 ? (
          <div style={{ ...textBase, fontSize: 74, fontWeight: 900, color: active === 3 ? "#fda4af" : C.goldHi, opacity: pop, transform: `scale(${0.85 + pop * 0.15})` }}>
            {copy.callouts[active]}
          </div>
        ) : (
          <div style={{ ...textBase, fontSize: 64, fontWeight: 900, opacity: phoneIn }}>{copy.reportTitle}</div>
        )}
      </div>
      <div style={{ position: "absolute", top: 340, left: 140, transform: `translateY(${(1 - phoneIn) * 700}px) rotate(${(1 - phoneIn) * 6}deg)` }}>
        <Phone copy={copy} active={active} />
      </div>
    </AbsoluteFill>
  );
};

// ── Scene 6: two cards merge (KO: 궁합 / EN: 7-day review) ────────────────────
const PairCard: React.FC<{ lines: [string, string]; side: -1 | 1; merge: number }> = ({ lines, side, merge }) => {
  const enter = useEnter(side === -1 ? 6 : 12);
  const color = side === -1 ? C.gold : C.indigo;
  const x = side * (235 + (1 - merge) * 40 + (1 - enter) * 600);
  return (
    <div
      style={{
        position: "absolute",
        left: 540 + x,
        top: 880,
        transform: `translate(-50%, -50%) rotate(${side * 8 * (1 - merge)}deg)`,
        width: 400,
        padding: "48px 24px",
        borderRadius: 32,
        background: C.card,
        border: `3px solid ${color}`,
        boxShadow: `0 0 ${20 + merge * 60}px ${color}55`,
        opacity: enter,
      }}
    >
      <div style={{ ...textBase, fontSize: 60, fontWeight: 900 }}>{lines[0]}</div>
      <div style={{ ...textBase, fontSize: 36, color: C.dim, marginTop: 14 }}>{lines[1]}</div>
    </div>
  );
};

const PairScene: React.FC<{ copy: Copy; len: number }> = ({ copy, len }) => {
  const frame = useCurrentFrame();
  const merge = interpolate(frame, [30, 50], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.cubic) });
  const result = useEnter(50, 11);
  return (
    <AbsoluteFill style={{ opacity: useExit(len) }}>
      <Rise style={{ position: "absolute", top: 330, width: "100%" }}>
        <div style={{ ...textBase, fontSize: 64, fontWeight: 800 }}>{copy.pairTitle}</div>
      </Rise>
      <PairCard lines={copy.pairLeft} side={-1} merge={merge} />
      <PairCard lines={copy.pairRight} side={1} merge={merge} />
      <div style={{ position: "absolute", left: 540, top: 880, width: 76, height: 76, borderRadius: 999, background: C.goldHi, transform: `translate(-50%, -50%) scale(${merge})`, display: "flex", justifyContent: "center", alignItems: "center", ...textBase, fontSize: 56, fontWeight: 900, color: C.bg }}>
        +
      </div>
      <div style={{ position: "absolute", top: 1170, width: "100%", opacity: result, transform: `scale(${0.7 + result * 0.3})` }}>
        <div style={{ ...textBase, fontSize: 68, fontWeight: 900, color: C.goldHi }}>{copy.pairResult}</div>
        <div style={{ ...textBase, fontSize: 44, fontWeight: 600, marginTop: 28, color: C.text }}>{copy.pairHook}</div>
      </div>
    </AbsoluteFill>
  );
};

// ── Scene 7: outro + CTA ─────────────────────────────────────────────────────
const OutroScene: React.FC<{ copy: Copy }> = ({ copy }) => {
  const cta = useEnter(34, 12);
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", padding: 70 }}>
      <Rise>
        <div style={{ ...textBase, fontSize: 60, fontWeight: 700, color: C.dim }}>{copy.outro[0]}</div>
      </Rise>
      <Rise delay={12} style={{ marginTop: 20 }}>
        <div style={{ ...textBase, fontSize: 82, fontWeight: 900, color: C.goldHi }}>{copy.outro[1]}</div>
      </Rise>
      <div style={{ marginTop: 100, opacity: cta, transform: `translateY(${(1 - cta) * 40}px)`, display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div style={{ ...textBase, fontSize: 46, fontWeight: 800, color: C.bg, background: C.goldHi, padding: "26px 56px", borderRadius: 999 }}>{copy.cta}</div>
        <div style={{ ...textBase, fontSize: 36, marginTop: 30, color: C.text }}>{copy.price}</div>
        <div style={{ ...textBase, fontSize: 58, fontWeight: 900, marginTop: 50, letterSpacing: "0.02em" }}>cosmicpath.app</div>
      </div>
      <div style={{ position: "absolute", bottom: 120, ...textBase, fontSize: 26, color: C.dim, opacity: cta, padding: "0 80px" }}>{copy.disclaimer}</div>
    </AbsoluteFill>
  );
};

type SceneProps = { copy: Copy; lang: PromoLang; len: number };

const SCENE_COMPONENTS: Record<(typeof SCENES)[number]["id"], React.FC<SceneProps>> = {
  hook: HookScene,
  pains: PainsScene,
  engines: EnginesScene,
  question: QuestionScene,
  saju: SajuTourScene,
  flow: FlowTourScene,
  heatmap: HeatmapTourScene,
  ziwei: ZiweiTourScene,
  report: ReportScene,
  pair: PairScene,
  outro: OutroScene,
};

export const PromoViral: React.FC<PromoViralProps> = ({ lang }) => {
  const copy = COPY[lang];
  return (
    <AbsoluteFill style={{ backgroundColor: C.bg }}>
      <Starfield />
      {SCENES.map((s) => {
        const SceneComponent = SCENE_COMPONENTS[s.id];
        return (
          <Sequence key={s.id} from={s.from} durationInFrames={s.len} name={s.id}>
            <SceneComponent copy={copy} lang={lang} len={s.len} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
