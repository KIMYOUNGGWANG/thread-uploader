import { afterAll, beforeAll, describe, expect, it } from "vitest";
import http from "http";
import fs from "fs/promises";
import path from "path";
import { runPlaywrightCapture } from "./capture-runner";

let server: http.Server;
let port: number;
const tempDir = path.join(__dirname, "temp-capture");

beforeAll(async () => {
  server = http.createServer((req, res) => {
    if (req.url === "/redirect-private") {
      res.writeHead(302, { Location: "http://10.0.0.1/private" });
      res.end();
      return;
    }
    
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(`
      <html>
        <head>
          <title>Test Invoice SaaS</title>
          <meta name="description" content="Easy invoicing tool for freelancers.">
        </head>
        <body>
          <main>
            <h1>InvoiceFlow</h1>
            <p>Reduce your invoicing time to under five minutes.</p>
          </main>
          <section class="pricing-card">
            <h2>Pro Plan</h2>
            <p>Costs only $19 per month</p>
            <button id="cta-btn">시작하기 (Free Trial)</button>
          </section>
          <footer>
            <a href="/login">로그인 하기</a>
          </footer>
        </body>
      </html>
    `);
  });

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      port = typeof addr === "object" && addr ? addr.port : 0;
      resolve();
    });
  });

  process.env.DEMO_ASSETS_ALLOW_LOCAL_FIXTURES = "1";
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
});

describe("Playwright Capture Runner", () => {
  it("captures screenshot assets, action log, and DOM elements from local fixture server", async () => {
    const jobId = "test_job_123";
    const url = `http://127.0.0.1:${port}/`;
    
    const result = await runPlaywrightCapture(jobId, url, tempDir);

    expect(result.title).toBe("Test Invoice SaaS");
    expect(result.description).toBe("Easy invoicing tool for freelancers.");
    expect(result.textBlocks.some(t => t.includes("InvoiceFlow"))).toBe(true);
    
    // Validate CTAs
    const ctas = result.ctas.map(c => c.text);
    expect(ctas).toContain("시작하기 (Free Trial)");
    expect(ctas).toContain("로그인 하기");

    // Validate that screenshots exist
    const hasInitial = await fs.stat(result.screenshotInitialPath).then(s => s.isFile()).catch(() => false);
    const hasFull = await fs.stat(result.screenshotFullPath).then(s => s.isFile()).catch(() => false);
    expect(hasInitial).toBe(true);
    expect(hasFull).toBe(true);

    // Validate section screenshots
    expect(result.sectionScreenshots.length).toBeGreaterThan(0);
    for (const secPath of result.sectionScreenshots) {
      const exists = await fs.stat(secPath).then(s => s.isFile()).catch(() => false);
      expect(exists).toBe(true);
    }

    // Validate action log contains steps
    expect(result.actionLog.length).toBeGreaterThan(0);
    expect(result.actionLog.some(l => l.includes("Browser launched"))).toBe(true);
    expect(result.actionLog.some(l => l.includes("Page navigation completed"))).toBe(true);
  }, 25000); // 25s timeout for browser launch
});
