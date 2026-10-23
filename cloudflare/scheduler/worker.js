// Cloudflare Worker cron: wakes on the schedules in wrangler.toml and pings the Vercel cron routes.
// GitHub Actions schedules ran 2-3 times a day instead of hourly (2026-10-22), so publishing missed slots.
// Deploy: see docs/ops/external-scheduler.md. Secret: `npx wrangler secret put CRON_SECRET`.

const DEFAULT_APP_URL = "https://thread-uploader.vercel.app";

// cron expression (must match wrangler.toml) → routes to call. Publish is slot-gated server-side, so the
// 15-minute cadence only gives each 3-hour slot window more chances; extra calls are no-ops.
export const ROUTES = {
  "*/15 * * * *": [
    "/api/cron/publish?brands=cosmicpath&slots=0,3,9,12,14",
    "/api/cron/publish?brands=cosmicpath-global&slots=0,12",
  ],
  "17 * * * *": ["/api/cron/replies"],
  "0 */2 * * *": ["/api/cron/account-intelligence"],
};

export function routesFor(cron) {
  return ROUTES[cron] ?? [];
}

async function ping(baseUrl, path, cronSecret) {
  // Cron triggers allow up to 15 min of wall clock (only CPU is capped at 10ms, and awaiting fetch uses none).
  // A publish inside an open slot takes 30-60s; waiting lets the log show its real 200 instead of an abort.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 290_000);
  try {
    const response = await fetch(`${baseUrl}${path}`, {
      headers: { Authorization: `Bearer ${cronSecret}` },
      signal: controller.signal,
    });
    const body = (await response.text()).slice(0, 300);
    console.log(`${response.status} ${path} ${body}`);
    return response.ok;
  } catch (error) {
    console.log(`timeout/err ${path} ${error instanceof Error ? error.message : String(error)}`);
    return false;
  } finally {
    clearTimeout(timer);
  }
}

const scheduler = {
  async scheduled(event, env, ctx) {
    if (!env.CRON_SECRET) throw new Error("CRON_SECRET secret is not set (npx wrangler secret put CRON_SECRET)");
    const baseUrl = (env.APP_URL ?? DEFAULT_APP_URL).replace(/\/$/, "");
    const paths = routesFor(event.cron);
    ctx.waitUntil(Promise.all(paths.map((path) => ping(baseUrl, path, env.CRON_SECRET))));
  },

  // Plain GET so the dashboard "Send request" button and uptime checks get a 200; no secrets, no side effects.
  async fetch() {
    return new Response(`threads-uploader scheduler: ${Object.keys(ROUTES).join(" | ")}`, {
      headers: { "content-type": "text/plain" },
    });
  },
};

export default scheduler;
