// PromoReportTour.tsx — format ①: 45s "what the paid report tells you" tour (9:16, silent).
// Topic, persona and every chart number come from props (PromoVariant + PromoSnapshot from the real
// cosmicpath engines). Copy rules (cosmicpath docs/product.md): no fabricated scores/percentages,
// no "판정/직답/권고", price only $9.99. The 궁합 pair scene is Korean-only; other cuts show /review.
import React from "react";
import { AbsoluteFill, Easing, Sequence, interpolate, useCurrentFrame } from "remotion";
import { ensurePretendard } from "../load-fonts";
import { C, Rise, Starfield, textBase, useEnter, useExit } from "../components/PromoKit";
import { HookScene, OutroScene, QuestionScene } from "../components/PromoScenes";
import { FlowTourScene, HeatmapTourScene, SajuTourScene, TourKicker, TOUR_TOTAL, ZiweiTourScene } from "../components/ReportTourScenes";
import { TOPIC_COPY, UI_COPY, hookLines, personaLine } from "../promo/copy.ts";
import { RELATION_TOPICS, type PromoLang, type PromoProps } from "../promo/types.ts";

void ensurePretendard();

type ReportUi = {
  painTitle: string; pains: [string, string, string]; engineTop: string; engineBottom: string; engines: string[];
  timeFix: string; reportTag: string; reportTitle: string; sample: string; callouts: string[];
};
type ReportCard = { title: string; body: string; tone?: "danger" };
type Pair = { title: string; left: [string, string]; right: [string, string]; result: string; hook: string };
type Copy = ReportUi & { question: string; forkA: string; forkB: string; cards: ReportCard[]; pair: Pair };

const REPORT_UI: Record<PromoLang, ReportUi> = {
  ko: {
    painTitle: "결정 앞에서 쓸모없던 이유",
    pains: ["누구에게나 맞는 두루뭉술한 위로", "동경시 그대로 쓴 30분 시차", "계산 없이 지어낸 AI 운세"],
    engineTop: "계산 엔진 5개가 먼저 계산하고",
    engineBottom: "AI는 해석만 해요",
    engines: ["사주", "서양 점성술", "자미두수", "태국 점성술", "수비학"],
    timeFix: "출생 도시 기준 시간 보정",
    reportTag: "유료 리포트",
    reportTitle: "7일 결정 패킷",
    sample: "예시 화면",
    callouts: ["언제 움직일지", "7일 동안 뭘 해볼지", "어떤 조건이면 갈지", "언제 접을지"],
  },
  en: {
    painTitle: "Why it never helped you decide",
    pains: ["Vague comfort that fits anyone", "Birth time off by 30 minutes", "AI fortunes with zero math"],
    engineTop: "5 calculation engines do the math",
    engineBottom: "AI only interprets",
    engines: ["Saju", "Western", "Zi Wei", "Thai", "Numerology"],
    timeFix: "Birth-city time correction",
    reportTag: "Paid report",
    reportTitle: "7-Day Decision Packet",
    sample: "Sample screen",
    callouts: ["When to move", "What to test for 7 days", "Which conditions say go", "When to walk away"],
  },
};

const REVIEW_PAIR: Record<PromoLang, Pair> = {
  ko: { title: "그리고 7일 뒤", left: ["Day 1", "내 계획"], right: ["Day 7", "실제 결과"], result: "결과 대조", hook: "내 선택을 현실과 맞춰봄" },
  en: { title: "Then, 7 days later", left: ["Day 1", "Your plan"], right: ["Day 7", "What happened"], result: "Decision Review", hook: "Your call, checked against reality." },
};

const CARD_TITLES: Record<PromoLang, [string, string, string, string]> = {
  ko: ["언제", "7일 실험", "조건: if / then", "접을 신호"],
  en: ["When", "7-day experiment", "If / then rules", "Stop rule"],
};

function buildPair({ lang, variant }: PromoProps): Pair {
  if (lang !== "ko" || !RELATION_TOPICS.includes(variant.topic)) return REVIEW_PAIR[lang];
  const dot = (date: string) => date.replaceAll("-", ". ");
  return { title: "고민이 '우리'라면", left: ["나", dot(variant.persona.birthDate)], right: ["너", dot(variant.guest.birthDate)], result: "궁합 Decision Note", hook: "“이거 너랑 나 돌려볼까?”" };
}

function buildCopy(props: PromoProps): Copy {
  const { lang, variant, snapshot } = props;
  const topic = TOPIC_COPY[lang][variant.topic];
  const peak = snapshot.scenario.peakLabel ?? "";
  const titles = CARD_TITLES[lang];
  return {
    ...REPORT_UI[lang], question: topic.question, forkA: topic.forkA, forkB: topic.forkB, pair: buildPair(props),
    cards: [
      { title: titles[0], body: lang === "ko" ? `첫 실행 적합 구간: ${peak}` : `First-move window: ${peak}` },
      { title: titles[1], body: topic.experiment[0] },
      { title: titles[2], body: topic.ifThen.join("\n") },
      { title: titles[3], body: topic.stopRule, tone: "danger" },
    ],
  };
}

// Scene timeline in frames (30 fps). Sums to FORMAT_FRAMES.reportTour (1350).
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
  const scroll = interpolate(frame, [60, 200], [0, -170], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.cubic) });
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

const ReportScene: React.FC<{ copy: Copy; lang: PromoLang; len: number }> = ({ copy, lang, len }) => {
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
        <div style={{ ...textBase, fontSize: 64, fontWeight: 800 }}>{copy.pair.title}</div>
      </Rise>
      <PairCard lines={copy.pair.left} side={-1} merge={merge} />
      <PairCard lines={copy.pair.right} side={1} merge={merge} />
      <div style={{ position: "absolute", left: 540, top: 880, width: 76, height: 76, borderRadius: 999, background: C.goldHi, transform: `translate(-50%, -50%) scale(${merge})`, display: "flex", justifyContent: "center", alignItems: "center", ...textBase, fontSize: 56, fontWeight: 900, color: C.bg }}>
        +
      </div>
      <div style={{ position: "absolute", top: 1170, width: "100%", opacity: result, transform: `scale(${0.7 + result * 0.3})` }}>
        <div style={{ ...textBase, fontSize: 68, fontWeight: 900, color: C.goldHi }}>{copy.pair.result}</div>
        <div style={{ ...textBase, fontSize: 44, fontWeight: 600, marginTop: 28, color: C.text }}>{copy.pair.hook}</div>
      </div>
    </AbsoluteFill>
  );
};


type SceneProps = { copy: Copy; props: PromoProps; len: number };

const SCENE_COMPONENTS: Record<(typeof SCENES)[number]["id"], React.FC<SceneProps>> = {
  hook: ({ props, len }) => <HookScene lines={hookLines(props.variant)} len={len} />,
  pains: ({ copy, len }) => <PainsScene copy={copy} len={len} />,
  engines: ({ copy, len }) => <EnginesScene copy={copy} len={len} />,
  question: ({ copy, props, len }) => (
    <QuestionScene label={UI_COPY[props.lang].questionLabel} question={copy.question} persona={personaLine(props.lang, props.variant.persona)} len={len} />
  ),
  saju: ({ props, len }) => <SajuTourScene lang={props.lang} len={len} snapshot={props.snapshot} topic={props.variant.topic} />,
  flow: ({ props, len }) => <FlowTourScene lang={props.lang} len={len} snapshot={props.snapshot} topic={props.variant.topic} />,
  heatmap: ({ props, len }) => <HeatmapTourScene lang={props.lang} len={len} snapshot={props.snapshot} topic={props.variant.topic} />,
  ziwei: ({ props, len }) => <ZiweiTourScene lang={props.lang} len={len} snapshot={props.snapshot} topic={props.variant.topic} />,
  report: ({ copy, props, len }) => <ReportScene copy={copy} lang={props.lang} len={len} />,
  pair: ({ copy, len }) => <PairScene copy={copy} len={len} />,
  outro: ({ props }) => <OutroScene lang={props.lang} match={false} />,
};

export const PromoReportTour: React.FC<PromoProps> = (props) => {
  const copy = buildCopy(props);
  return (
    <AbsoluteFill style={{ backgroundColor: C.bg }}>
      <Starfield />
      {SCENES.map((s) => {
        const SceneComponent = SCENE_COMPONENTS[s.id];
        return (
          <Sequence key={s.id} from={s.from} durationInFrames={s.len} name={s.id}>
            <SceneComponent copy={copy} props={props} len={s.len} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
