// Post response analysis on a snapshot from export-post-metrics.mjs.
// Reach = views, detrended by half-month period (log10). Engagement = organic (likes + reposts + replies
// minus our own first comment) per 1,000 views, pooled per group. CIs are bootstrap; p is a permutation
// test on the median difference; q is Benjamini-Hochberg across all comparisons of a brand.
// Usage: node scripts/analyze-post-response.mjs <snapshot.json> [--min-age-days=3]
//        node scripts/analyze-post-response.mjs --self-test
import { readFileSync } from "node:fs";

const args = process.argv.slice(2);
const flag = (name, fallback) => args.find((a) => a.startsWith(`--${name}=`))?.split("=")[1] ?? fallback;
const ITER = 2000;
const MIN_GROUP = 5;
const KST_MS = 9 * 3600e3;

function seeded(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const random = seeded(20261016);

const sum = (xs) => xs.reduce((a, b) => a + b, 0);
function quantile(xs, q) {
  const s = [...xs].sort((a, b) => a - b);
  if (!s.length) return NaN;
  const i = (s.length - 1) * q;
  const lo = Math.floor(i);
  return s[lo] + (s[Math.ceil(i)] - s[lo]) * (i - lo);
}
const median = (xs) => quantile(xs, 0.5);
const sd = (xs) => { const m = sum(xs) / xs.length; return Math.sqrt(sum(xs.map((x) => (x - m) ** 2)) / (xs.length - 1)); };
const resample = (xs) => xs.map(() => xs[Math.floor(random() * xs.length)]);
function shuffle(xs) {
  const out = [...xs];
  for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
  return out;
}
function groupBy(xs, key) {
  const out = {};
  for (const x of xs) (out[key(x)] ??= []).push(x);
  return out;
}
function bh(ps) {
  const order = ps.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]);
  const q = new Array(ps.length);
  let min = 1;
  for (let k = order.length - 1; k >= 0; k--) { min = Math.min(min, (order[k][0] * ps.length) / (k + 1)); q[order[k][1]] = min; }
  return q;
}

function compareReach(group, rest) {
  const g = group.map((p) => p.detrended);
  const r = rest.map((p) => p.detrended);
  const obs = median(g) - median(r);
  const boots = Array.from({ length: ITER }, () => median(resample(g)) - median(resample(r)));
  const pooled = [...g, ...r];
  let extreme = 0;
  for (let i = 0; i < ITER; i++) {
    const s = shuffle(pooled);
    if (Math.abs(median(s.slice(0, g.length)) - median(s.slice(g.length))) >= Math.abs(obs) - 1e-12) extreme++;
  }
  return { ratio: 10 ** obs, lo: 10 ** quantile(boots, 0.025), hi: 10 ** quantile(boots, 0.975), p: (extreme + 1) / (ITER + 1) };
}

const engRate = (ps) => { const v = sum(ps.map((p) => p.views)); return v ? (sum(ps.map((p) => p.eng)) / v) * 1000 : NaN; };
function compareEngagement(group, rest) {
  const boots = Array.from({ length: ITER }, () => engRate(resample(group)) / engRate(resample(rest))).filter(Number.isFinite);
  return { rate: engRate(group), ratio: engRate(group) / engRate(rest), lo: quantile(boots, 0.025), hi: quantile(boots, 0.975) };
}

function measuredPosts(brand) {
  return brand.posts.filter((p) => p.publishedAt && p.metricsAt && p.views != null).map((p) => {
    const published = new Date(p.publishedAt);
    const kst = new Date(published.getTime() + KST_MS);
    const organicReplies = Math.max((p.replies ?? 0) - (p.firstComment ? 1 : 0), 0);
    return {
      ...p, kst, organicReplies,
      ageDays: (new Date(p.metricsAt) - published) / 864e5,
      logViews: Math.log10(p.views + 1),
      eng: (p.likes ?? 0) + (p.reposts ?? 0) + organicReplies,
      period: `${kst.toISOString().slice(0, 7)}-${kst.getUTCDate() <= 15 ? "a" : "b"}`,
      firstLine: p.content.split("\n").find((l) => l.trim())?.trim() ?? "",
    };
  });
}

function prepare(brand, minAgeDays) {
  const measured = measuredPosts(brand);
  const aged = measured.filter((p) => p.ageDays >= minAgeDays);
  const byPeriod = groupBy(aged, (p) => p.period);
  // ponytail: periods under MIN_GROUP posts are dropped instead of merged; merge if posting gets sparse
  const posts = aged.filter((p) => byPeriod[p.period].length >= MIN_GROUP);
  const periodMedian = {};
  for (const [period, ps] of Object.entries(byPeriod)) if (ps.length >= MIN_GROUP) periodMedian[period] = median(ps.map((p) => p.logViews));
  posts.forEach((p) => { p.detrended = p.logViews - periodMedian[p.period]; });
  return { posts, periodMedian, dropped: { young: measured.length - aged.length, sparsePeriod: aged.length - posts.length, unmeasured: brand.posts.length - measured.length } };
}

const HOURS = [[0, "새벽 0-6시"], [6, "오전 6-12시"], [12, "오후 12-18시"], [18, "저녁 18-24시"]];
function featureFns(posts) {
  const cuts = [quantile(posts.map((p) => p.content.length), 1 / 3), quantile(posts.map((p) => p.content.length), 2 / 3)];
  return {
    formula: (p) => p.formulaId,
    hook: (p) => p.hookType,
    cta: (p) => p.ctaType,
    category: (p) => p.postCategory,
    link: (p) => (p.linkUrl ? "링크 있음" : null),
    image: (p) => (p.imageUrls !== "[]" ? "이미지 있음" : null),
    length: (p) => (p.content.length <= cuts[0] ? `짧음 ≤${Math.round(cuts[0])}자` : p.content.length <= cuts[1] ? "중간" : `김 >${Math.round(cuts[1])}자`),
    hour: (p) => HOURS.findLast(([h]) => p.kst.getUTCHours() >= h)[1],
    weekend: (p) => ([0, 6].includes(p.kst.getUTCDay()) ? "주말" : null),
    firstLineNumber: (p) => (/\d/.test(p.firstLine) ? "첫 줄에 숫자" : null),
    firstLineQuestion: (p) => (/[?？]\s*$/.test(p.firstLine) ? "첫 줄 질문형" : null),
  };
}

const DIM_FIELD = { formula: "formulaId", cta: "ctaType", hook: "hookType", topic: "topic", target: "targetAudience" };
const x = (v) => (Number.isFinite(v) ? `${v.toFixed(2)}x` : "-");
const n0 = (v) => (Number.isFinite(v) ? Math.round(v).toLocaleString("en-US") : "-");
const cut = (s, len) => (s.length > len ? `${s.slice(0, len)}…` : s).replaceAll("|", "/");

function analyzeBrand(brand, minAgeDays) {
  const { posts, periodMedian, dropped } = prepare(brand, minAgeDays);
  const out = [`## ${brand.slug}`, ""];
  const views = posts.map((p) => p.views);
  const engaged = posts.filter((p) => p.eng > 0).length;
  out.push("### 기준선", "",
    `- 분석 대상 ${posts.length}개 (측정 시점 ${minAgeDays}일 미만 제외 ${dropped.young}, 글 ${MIN_GROUP}개 미만 기간 제외 ${dropped.sparsePeriod}, 미측정 ${dropped.unmeasured})`,
    `- 조회수 중앙값 ${n0(median(views))} · p10 ${n0(quantile(views, 0.1))} · p90 ${n0(quantile(views, 0.9))} · 최대 ${n0(Math.max(...views))}`,
    `- 상위 1개 글이 전체 조회수의 ${((Math.max(...views) / sum(views)) * 100).toFixed(0)}% 차지`,
    `- 유기적 참여(첫 댓글 제외) 1,000뷰당 ${engRate(posts).toFixed(1)} · 유기적 참여 1건 이상 글 ${engaged}/${posts.length}`,
    `- 기간별 조회수 중앙값: ${Object.entries(periodMedian).sort().map(([k, v]) => `${k} ${n0(10 ** v - 1)}`).join(" → ")}`, "");

  const fns = featureFns(posts);
  const rows = [];
  for (const [dim, fn] of Object.entries(fns)) {
    for (const [value, group] of Object.entries(groupBy(posts.filter((p) => fn(p) != null), fn))) {
      const rest = posts.filter((p) => fn(p) !== value);
      if (group.length < MIN_GROUP || rest.length < MIN_GROUP) continue;
      rows.push({ dim, value, n: group.length, medianViews: median(group.map((p) => p.views)), reach: compareReach(group, rest), eng: compareEngagement(group, rest) });
    }
  }
  bh(rows.map((r) => r.reach.p)).forEach((q, i) => { rows[i].reach.q = q; });
  rows.sort((a, b) => a.reach.q - b.reach.q || a.reach.p - b.reach.p);
  out.push(`### 특징별 비교 (${rows.length}개 비교, 그룹 ${MIN_GROUP}개 이상, 나머지 전체 대비)`, "",
    "도달 배수 = 기간 보정 후 조회수 중앙값 비율. CI가 1을 넘나들면 효과를 확인 못 한 거야.", "",
    "| 차원 | 값 | n | 조회수 중앙값 | 도달 배수 [95% CI] | p | q | 참여/1천뷰 | 참여 배수 [95% CI] |",
    "|---|---|---|---|---|---|---|---|---|");
  for (const r of rows) {
    out.push(`| ${r.dim} | ${cut(r.value, 28)} | ${r.n} | ${n0(r.medianViews)} | ${x(r.reach.ratio)} [${x(r.reach.lo)}, ${x(r.reach.hi)}] | ${r.reach.p.toFixed(3)} | ${r.reach.q.toFixed(2)} | ${r.eng.rate.toFixed(1)} | ${x(r.eng.ratio)} [${x(r.eng.lo)}, ${x(r.eng.hi)}] |`);
  }

  const memory = brand.growthMemory ?? {};
  out.push("", "### 학습 루프(growthMemory) 승자·약점 재검증", "",
    "| 구분 | 차원 | 값 | 루프 n | 루프 평균 조회 | 스냅샷 n | 평균 | 중앙값 | 최고 글 제외 평균 | 도달 배수 [95% CI] | 판정 |",
    "|---|---|---|---|---|---|---|---|---|---|---|");
  for (const [kind, list] of [["승자", memory.winners ?? []], ["약점", memory.weakSignals ?? []]]) {
    for (const entry of list) {
      const field = DIM_FIELD[entry.dimension];
      const group = field ? posts.filter((p) => p[field] === entry.value) : [];
      const v = group.map((p) => p.views).sort((a, b) => a - b);
      const rest = posts.filter((p) => !group.includes(p));
      const reach = group.length >= MIN_GROUP ? compareReach(group, rest) : null;
      const verdict = !reach ? "표본 부족" : reach.lo > 1 ? "근거 있음(↑)" : reach.hi < 1 ? "근거 있음(↓)" : "효과 미확인";
      out.push(`| ${kind} | ${entry.dimension} | ${cut(entry.value, 28)} | ${entry.count} | ${n0(entry.avgViews)} | ${group.length} | ${n0(sum(v) / v.length)} | ${n0(median(v))} | ${v.length > 1 ? n0(sum(v.slice(0, -1)) / (v.length - 1)) : "-"} | ${reach ? `${x(reach.ratio)} [${x(reach.lo)}, ${x(reach.hi)}]` : "-"} | ${verdict} |`);
    }
  }

  const s = sd(posts.map((p) => p.detrended));
  const nPerArm = (ratio) => Math.ceil((2 * (1.96 + 0.8416) ** 2 * s ** 2) / Math.log10(ratio) ** 2);
  const lastFourWeeks = posts.filter((p) => p.kst >= new Date(Math.max(...posts.map((q) => q.kst)) - 28 * 864e5)).length / 4;
  out.push("", "### 실험 검정력 (양측 α=0.05, 검정력 80%, 로그 조회수 평균 기준 근사)", "",
    `- 기간 보정 로그 조회수 표준편차 ${s.toFixed(2)} (조회수 기준 약 ${x(10 ** s)} 배 퍼짐)`,
    ...[1.5, 2, 3].map((r) => `- 조회수 ${r}배 차이를 잡으려면 그룹당 ${nPerArm(r)}개, 총 ${nPerArm(r) * 2}개 (최근 주당 ${lastFourWeeks.toFixed(0)}개 발행 기준 약 ${((nPerArm(r) * 2) / lastFourWeeks).toFixed(1)}주)`),
    "- 중앙값 비교는 평균보다 효율이 낮아서 실제로는 이보다 더 필요해.", "");

  const ranked = [...posts].sort((a, b) => b.detrended - a.detrended);
  for (const [title, list] of [["상위 10 (기간 보정 도달)", ranked.slice(0, 10)], ["하위 10 (기간 보정 도달)", ranked.slice(-10).reverse()]]) {
    out.push(`### ${title}`, "", "| 발행일(KST) | 조회수 | 유기 참여 | formula | 길이 | 링크 | 첫 줄 |", "|---|---|---|---|---|---|---|");
    for (const p of list) out.push(`| ${p.kst.toISOString().slice(0, 10)} | ${n0(p.views)} | ${p.eng} | ${p.formulaId ?? "-"} | ${p.content.length} | ${p.linkUrl ? "O" : ""} | ${cut(p.firstLine, 60)} |`);
    out.push("");
  }
  return out.join("\n");
}

// Pre-registered verdict for a randomized length experiment (docs/experiments/2026-10-16-post-length.md).
// Randomized within one window, so raw log views are compared without period detrending.
// Mirrors isExperimentDraft/classifyLength in src/lib/length-experiment.ts: GROWTH, not a promo video,
// not a New Year post (NEW_YEAR_MODE_IDS in src/lib/new-year/new-year-season.ts), created at/after the start, S or L. Only the first `total` by publish time are the experiment; later ones are not.
// Snapshots exported before createdAt was added fall back to publishedAt.
const NEW_YEAR_MODE_IDS = ["ny_ranking", "ny_ipchun", "ny_monthly", "ny_pick"];
function experimentSample(posts, { from, shortMax, longMin, total }) {
  const eligible = posts
    .filter((p) => p.postCategory === "GROWTH" && !(p.formulaId ?? "").startsWith("video:") && !NEW_YEAR_MODE_IDS.includes(p.formulaId))
    .filter((p) => Date.parse(p.createdAt ?? p.publishedAt) >= Date.parse(from) && Date.parse(p.publishedAt) >= Date.parse(from))
    .filter((p) => p.content.length <= shortMax || p.content.length >= longMin)
    .sort((a, b) => Date.parse(a.publishedAt) - Date.parse(b.publishedAt));
  return { sample: eligible.slice(0, total), overflow: Math.max(0, eligible.length - total) };
}

function formulaMix(posts) {
  const counts = Object.entries(groupBy(posts, (p) => p.formulaId ?? "-")).map(([id, ps]) => [id, ps.length]).sort((a, b) => b[1] - a[1]);
  return counts.slice(0, 5).map(([id, n]) => `${id} ${Math.round((n / posts.length) * 100)}%`).join(", ") || "-";
}

function judgeLengthExperiment(snapshot, { slug, from, shortMax, longMin, plannedN, minAgeDays }) {
  const brand = snapshot.brands.find((b) => b.slug === slug);
  if (!brand) throw new Error(`brand ${slug} not in snapshot`);
  // Cut first, measure second: a post missing metrics shows up as a shortfall instead of letting a later post in.
  const { sample, overflow } = experimentSample(brand.posts.filter((p) => p.publishedAt), { from, shortMax, longMin, total: plannedN * 2 });
  const aged = measuredPosts({ posts: sample }).filter((p) => p.ageDays >= minAgeDays);
  aged.forEach((p) => { p.detrended = p.logViews; });
  const short = aged.filter((p) => p.content.length <= shortMax);
  const long = aged.filter((p) => p.content.length >= longMin);
  const out = [`# 길이 실험 판정: ${slug} (${from}~, 짧은 글 ≤${shortMax}자 vs 긴 글 ≥${longMin}자)`, "",
    `- 실험 표본 ${sample.length}/${plannedN * 2}개(시작 후 처음 발행된 실험 대상 S/L 글), 컷오프 이후 제외 ${overflow}개, 측정 시점 ${minAgeDays}일 이상 ${aged.length}개`];
  // Held = progress check only. Medians or formula mix here would let a mid-experiment peek steer the run.
  if (short.length < plannedN || long.length < plannedN) {
    out.push(`- 짧은 글 ${short.length}/${plannedN}개 · 긴 글 ${long.length}/${plannedN}개 (측정 시점 ${minAgeDays}일 이상 기준)`, "",
      "판정 보류: 사전에 정한 글 수에 못 미쳐. 결과 수치는 다 찼을 때만 보여줘. 중간에 결과를 보고 멈추면 안 돼.");
    return out.join("\n");
  }
  out.push(`- 짧은 글 ${short.length}/${plannedN}개 · 조회수 중앙값 ${n0(median(short.map((p) => p.views)))} · 공식 구성: ${formulaMix(short)}`,
    `- 긴 글 ${long.length}/${plannedN}개 · 조회수 중앙값 ${n0(median(long.map((p) => p.views)))} · 공식 구성: ${formulaMix(long)}`);
  const reach = compareReach(short, long);
  const eng = compareEngagement(short, long);
  out.push(`- 도달 배수 ${x(reach.ratio)} [95% CI ${x(reach.lo)}, ${x(reach.hi)}] · 순열 p ${reach.p.toFixed(3)}`,
    `- 참여(1천뷰당) 짧은 ${eng.rate.toFixed(1)} vs 긴 ${engRate(long).toFixed(1)} · 배수 ${x(eng.ratio)} [${x(eng.lo)}, ${x(eng.hi)}]`, "",
    reach.lo > 1 ? "판정: 통과 (CI 하한 > 1). 짧은 글이 도달을 높인다는 근거가 있어."
      : reach.hi < 1 ? "판정: 반대 방향 (CI 상한 < 1). 긴 글이 더 나아."
        : "판정: 효과 확인 못 함 (CI가 1을 포함). 가설을 버리고 다음 가설로 넘어가.");
  return out.join("\n");
}

function selfTest() {
  const assert = (cond, msg) => { if (!cond) throw new Error(`self-test failed: ${msg}`); };
  assert(median([3, 1, 2]) === 2, "median");
  assert(quantile([0, 10], 0.25) === 2.5, "quantile interpolation");
  const q = bh([0.01, 0.04, 0.03, 0.5]);
  assert([0.04, 0.16 / 3, 0.16 / 3, 0.5].every((v, i) => Math.abs(q[i] - v) < 1e-9), `bh ${q}`);
  const same = Array.from({ length: 20 }, (_, i) => ({ detrended: i / 10 }));
  const r = compareReach(same, same);
  assert(Math.abs(r.ratio - 1) < 1e-9 && r.lo <= 1 && r.hi >= 1 && r.p > 0.5, "identical groups show no effect");
  const shifted = same.map((p) => ({ detrended: p.detrended + 1 }));
  assert(compareReach(shifted, same).lo > 1, "shifted group detected");
  const from = "2026-10-20T00:00:00.000Z";
  const fake = Array.from({ length: 92 }, (_, i) => ({
    content: "가".repeat(i % 2 ? 420 : 200), postCategory: "GROWTH", formulaId: "f",
    createdAt: from, publishedAt: new Date(Date.parse(from) + (i + 1) * 3600e3).toISOString(),
  }));
  const extras = [
    { ...fake[0], postCategory: "WARMUP" }, { ...fake[0], formulaId: "video:promo" },
    { ...fake[0], createdAt: "2026-10-19T00:00:00.000Z" }, { ...fake[0], content: "가".repeat(300) },
    { ...fake[0], formulaId: "ny_pick" },
  ];
  const { sample, overflow } = experimentSample([...extras, ...fake], { from, shortMax: 260, longMin: 390, total: 90 });
  assert(sample.length === 90 && overflow === 2, `experiment sample cutoff ${sample.length}/${overflow}`);
  assert(sample.at(-1).publishedAt === fake[89].publishedAt, "sample keeps the first 90 by publish time");
  // An unmeasured post inside the first 90 must leave a gap, not pull the post-experiment 91st into the sample.
  const measured = fake.map((p, i) => ({
    ...p, id: `p${i}`, firstComment: null, views: 100, likes: 0, replies: 0, reposts: 0,
    metricsAt: i === 4 ? null : new Date(Date.parse(p.publishedAt) + 8 * 864e5).toISOString(),
  }));
  const verdict = judgeLengthExperiment({ brands: [{ slug: "x", posts: measured }] }, { slug: "x", from, shortMax: 260, longMin: 390, plannedN: 45, minAgeDays: 7 });
  assert(verdict.includes("짧은 글 44/45"), "cutoff applies before the measurement filter");
  // A held verdict is a progress check: running it mid-experiment must not leak interim results.
  assert(verdict.includes("판정 보류") && !verdict.includes("중앙값") && !verdict.includes("공식 구성"), "held verdict hides interim results");
  const complete = measured.map((p) => ({ ...p, metricsAt: p.metricsAt ?? measured[0].metricsAt }));
  const finalVerdict = judgeLengthExperiment({ brands: [{ slug: "x", posts: complete }] }, { slug: "x", from, shortMax: 260, longMin: 390, plannedN: 45, minAgeDays: 7 });
  assert(finalVerdict.includes("짧은 글 45/45개 · 조회수 중앙값") && finalVerdict.includes("판정:"), "complete experiment shows the verdict");
  console.log("self-test ok");
}

if (args.includes("--self-test")) {
  selfTest();
} else {
  const path = args.find((a) => !a.startsWith("--"));
  if (!path) throw new Error("snapshot path required");
  const snapshot = JSON.parse(readFileSync(path, "utf8"));
  const experiment = flag("experiment", null);
  if (experiment) {
    console.log(judgeLengthExperiment(snapshot, {
      slug: experiment,
      from: flag("from", null) ?? (() => { throw new Error("--from=<startAt ISO, e.g. 2026-10-20T03:14:15.926Z> required"); })(),
      shortMax: Number(flag("short-max", 260)),
      longMin: Number(flag("long-min", 390)),
      plannedN: Number(flag("planned-n", 45)),
      minAgeDays: Number(flag("min-age-days", 7)),
    }));
  } else {
    const minAgeDays = Number(flag("min-age-days", 3));
    console.log(`# 글 반응 분석 (스냅샷 ${snapshot.exportedAt}, 측정 시점 ${minAgeDays}일 이상)\n`);
    for (const brand of snapshot.brands) console.log(analyzeBrand(brand, minAgeDays), "\n");
  }
}
