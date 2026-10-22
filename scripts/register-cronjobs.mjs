// Registers the time-sensitive cron routes on cron-job.org (GitHub schedules lag by hours; see docs/ops/external-scheduler.md).
// The secret goes straight from your .env.local to cron-job.org; nothing is printed.
//
// Usage:
//   node --env-file=.env --env-file=.env.local scripts/register-cronjobs.mjs            # dry run: prints the jobs it would create
//   node --env-file=.env --env-file=.env.local scripts/register-cronjobs.mjs --apply    # creates missing jobs (idempotent by title)
// CRON_SECRET comes from .env (same value as Vercel); put CRONJOB_API_KEY (cron-job.org Console → Settings → API) in .env.local.

const API = "https://api.cron-job.org";
const APP_URL = (process.env.APP_URL ?? "https://thread-uploader.vercel.app").replace(/\/$/, "");
const EVERY = [-1];
const base = { months: EVERY, mdays: EVERY, wdays: EVERY, timezone: "UTC", expiresAt: 0 };

// Only routes where hours of lag hurt. refill (3/day) and the daily metrics chain stay on GitHub Actions.
const JOBS = [
  { title: "threads publish KR", url: `${APP_URL}/api/cron/publish?brands=cosmicpath&slots=0,3,9,12,14`, schedule: { ...base, hours: EVERY, minutes: [2, 17, 32, 47] } },
  { title: "threads publish Global", url: `${APP_URL}/api/cron/publish?brands=cosmicpath-global&slots=0,12`, schedule: { ...base, hours: EVERY, minutes: [5, 20, 35, 50] } },
  { title: "threads replies", url: `${APP_URL}/api/cron/replies`, schedule: { ...base, hours: EVERY, minutes: [17] } },
  { title: "threads account-intelligence", url: `${APP_URL}/api/cron/account-intelligence`, schedule: { ...base, hours: [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22], minutes: [0] } },
];

const apply = process.argv.includes("--apply");
const apiKey = process.env.CRONJOB_API_KEY;
const cronSecret = process.env.CRON_SECRET;
if (!apiKey || !cronSecret) {
  console.error("CRONJOB_API_KEY and CRON_SECRET must be set (use --env-file=.env.local)");
  process.exit(1);
}

const headers = { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" };
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function listTitles() {
  const response = await fetch(`${API}/jobs`, { headers });
  if (!response.ok) throw new Error(`GET /jobs failed: ${response.status} ${await response.text()}`);
  const data = await response.json();
  return new Set((data.jobs ?? []).map((job) => job.title));
}

function buildJob(job) {
  return {
    job: {
      url: job.url,
      title: job.title,
      enabled: true,
      saveResponses: true,
      requestMethod: 0,
      // Free plan caps the request at 30s; Vercel keeps running the route after the client disconnects.
      requestTimeout: 30,
      schedule: job.schedule,
      extendedData: { headers: { Authorization: `Bearer ${cronSecret}` }, body: "" },
    },
  };
}

const existing = await listTitles().catch((error) => {
  if (apply) throw error;
  console.warn(`(dry run) could not list existing jobs: ${error.message}`);
  return new Set();
});
for (const job of JOBS) {
  const payload = buildJob(job);
  const masked = JSON.stringify({ ...payload.job, extendedData: { headers: { Authorization: "Bearer ***" } } });
  if (existing.has(job.title)) {
    console.log(`skip (exists): ${job.title}`);
    continue;
  }
  if (!apply) {
    console.log(`would create: ${masked}`);
    continue;
  }
  const response = await fetch(`${API}/jobs`, { method: "PUT", headers, body: JSON.stringify(payload) });
  const text = await response.text();
  if (!response.ok) throw new Error(`PUT /jobs failed for ${job.title}: ${response.status} ${text}`);
  console.log(`created: ${job.title} → ${text}`);
  await sleep(1200); // API rate limit: 1 request/second
}
console.log(apply ? "done" : "dry run (pass --apply to create)");
