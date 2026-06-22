import { chromium, devices } from "playwright";

async function main() {
  console.log("Testing capture for apps.apple.com...");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 430, height: 932 }, // iPhone 14 Pro size
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    locale: "en-US",
  });
  const page = await context.newPage();

  page.on("requestfailed", (req) => {
    console.log(`Request failed: ${req.url()} - ${req.failure()?.errorText}`);
  });

  page.on("response", (res) => {
    console.log(`Response: ${res.status()} ${res.url()}`);
  });

  try {
    console.log("Navigating...");
    await page.goto("https://apps.apple.com/ca/app/barshelf-home-bar-ai/id6754469129", {
      waitUntil: "domcontentloaded",
      timeout: 20000,
    });
    console.log("Page title:", await page.title());
    await page.screenshot({ path: "test_apple_capture.png" });
    console.log("Screenshot saved!");
  } catch (err) {
    console.error("Capture failed:", err);
  } finally {
    await browser.close();
  }
}

main();
