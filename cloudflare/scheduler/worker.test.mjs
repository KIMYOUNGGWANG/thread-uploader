// node --test cloudflare/scheduler/  — stdlib only, no vitest (this folder is deployed to Cloudflare, not bundled by Next).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import worker, { ROUTES, routesFor } from "./worker.js";

test("every cron in wrangler.toml has routes and vice versa", () => {
  const toml = readFileSync(new URL("./wrangler.toml", import.meta.url), "utf8");
  const crons = [...toml.matchAll(/"([^"]+)"/g)].map((m) => m[1]).filter((s) => /^[\d*\/ ,-]+$/.test(s) && s.split(" ").length === 5);
  assert.deepEqual(crons.sort(), Object.keys(ROUTES).sort());
});

test("scheduled() calls the secret-bearing routes for its cron and nothing for an unknown one", async () => {
  const calls = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    calls.push({ url, auth: init.headers.Authorization });
    return new Response("{}", { status: 200 });
  };
  try {
    const waits = [];
    const ctx = { waitUntil: (p) => waits.push(p) };
    await worker.scheduled({ cron: "17 * * * *" }, { CRON_SECRET: "s3cret", APP_URL: "https://x.test/" }, ctx);
    await Promise.all(waits);
    assert.deepEqual(calls, [{ url: "https://x.test/api/cron/replies", auth: "Bearer s3cret" }]);

    await worker.scheduled({ cron: "59 23 31 12 *" }, { CRON_SECRET: "s3cret" }, ctx);
    await Promise.all(waits);
    assert.equal(calls.length, 1);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("scheduled() refuses to run without the secret instead of calling with 'Bearer undefined'", async () => {
  await assert.rejects(() => worker.scheduled({ cron: "17 * * * *" }, {}, { waitUntil() {} }), /CRON_SECRET/);
  assert.equal(routesFor("*/15 * * * *").length, 3);
  assert.ok(routesFor("*/15 * * * *").includes("/api/cron/instagram-publish?brands=cosmicpath"));
});
