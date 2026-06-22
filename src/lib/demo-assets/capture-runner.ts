import { chromium, devices } from "playwright";
import fs from "fs/promises";
import path from "path";
import { isPrivateHost, shouldBypassLocalhost } from "./url-intake";

export interface CaptureResult {
  screenshotInitialPath: string;
  screenshotFullPath: string;
  sectionScreenshots: string[];
  textBlocks: string[];
  ctas: Array<{ text: string; selector: string }>;
  title: string;
  description: string;
  actionLog: string[];
}

export async function runPlaywrightCapture(
  jobId: string,
  url: string,
  outputDir: string
): Promise<CaptureResult> {
  const actionLog: string[] = [];
  const logAction = (msg: string) => {
    actionLog.push(`[${new Date().toISOString()}] ${msg}`);
  };

  logAction(`Starting capture for job ${jobId} targeting URL: ${url}`);

  await fs.mkdir(outputDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  logAction("Browser launched");

  const iphone14 = devices["iPhone 14 Pro"];
  const isAppStore = url.includes("apps.apple.com");
  const contextOptions: any = {
    ...iphone14,
    locale: "ko-KR",
    timezoneId: "America/Vancouver",
    colorScheme: "light",
    reducedMotion: "reduce",
  };

  if (isAppStore) {
    // Prevent redirect to itms-appss:// deep link by using a desktop User Agent
    contextOptions.userAgent = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
  }

  const context = await browser.newContext(contextOptions);
  logAction(`Browser context created (iPhone 14 Pro profile${isAppStore ? " with desktop User-Agent override" : ""})`);

  const page = await context.newPage();
  logAction("New page opened");

  // SSRF Protection during subresource loading
  await page.route("**/*", async (route) => {
    const request = route.request();
    const reqUrlStr = request.url();
    try {
      const parsed = new URL(reqUrlStr);

      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        logAction(`Blocked protocol: ${reqUrlStr}`);
        await route.abort("blockedbyclient");
        return;
      }

      const isPrivate = await isPrivateHost(parsed.hostname);
      if (isPrivate) {
        logAction(`Blocked private host: ${reqUrlStr}`);
        await route.abort("blockedbyclient");
        return;
      }

      await route.continue();
    } catch (err) {
      logAction(`Error during routing check for ${reqUrlStr}: ${err}`);
      await route.abort("blockedbyclient");
    }
  });

  logAction("SSRF request filter rules registered");

  try {
    logAction(`Navigating to ${url}`);
    await page.goto(url, { waitUntil: "networkidle", timeout: 15000 });
    logAction("Page navigation completed");

    // 1. Initial viewport screenshot
    const screenshotInitialPath = path.join(outputDir, "screenshot_initial.png");
    await page.screenshot({ path: screenshotInitialPath });
    logAction(`Initial screenshot captured at ${screenshotInitialPath}`);

    // 2. Full-page screenshot
    const screenshotFullPath = path.join(outputDir, "screenshot_full.png");
    await page.screenshot({ path: screenshotFullPath, fullPage: true });
    logAction(`Full-page screenshot captured at ${screenshotFullPath}`);

    // 3. Section screenshots (up to 4)
    const sectionScreenshots: string[] = [];
    const selectors = ["main", "section", "[class*='pricing']", "[id*='pricing']", "footer"];
    for (const selector of selectors) {
      try {
        const elements = await page.$$(selector);
        for (const el of elements) {
          const box = await el.boundingBox();
          if (box && box.width > 50 && box.height > 50) {
            const cleanSelector = selector.replace(/[^a-zA-Z0-9]/g, "_");
            const filename = `section_${cleanSelector}_${sectionScreenshots.length}.png`;
            const filePath = path.join(outputDir, filename);
            await el.screenshot({ path: filePath });
            sectionScreenshots.push(filePath);
            logAction(`Captured element section (${selector}) to ${filePath}`);
            if (sectionScreenshots.length >= 4) break;
          }
        }
      } catch (err) {
        // Skip selector errors
      }
      if (sectionScreenshots.length >= 4) break;
    }

    // 4. Extract text blocks, CTAs, and metadata via page.evaluate
    logAction("Extracting DOM content evidence");
    const extractedData = (await page.evaluate(`(() => {
      const textBlocks = [];
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
        acceptNode: (node) => {
          const parent = node.parentElement;
          if (!parent) return NodeFilter.FILTER_REJECT;
          const style = window.getComputedStyle(parent);
          if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") {
            return NodeFilter.FILTER_REJECT;
          }
          const tag = parent.tagName.toLowerCase();
          if (tag === "script" || tag === "style" || tag === "noscript") {
            return NodeFilter.FILTER_REJECT;
          }
          return NodeFilter.FILTER_ACCEPT;
        },
      });

      let currentNode;
      while ((currentNode = walker.nextNode())) {
        const text = currentNode.textContent?.trim() || "";
        const cleanText = text.replace(/\\s+/g, " ");
        if (cleanText.length > 10 && cleanText.length < 500) {
          textBlocks.push(cleanText);
        }
      }

      const ctas = [];
      const elements = Array.from(document.querySelectorAll("a, button"));
      const ctaKeywords = [
        "시작", "가입", "구매", "다운로드", "체험", "로그인", "등록", "받기", "구독",
        "start", "try", "buy", "join", "sign up", "download", "free", "get", "subscribe", "login"
      ];

      for (const el of elements) {
        const text = el.textContent?.trim() || "";
        const cleanText = text.replace(/\\s+/g, " ");
        if (cleanText.length >= 2 && cleanText.length <= 25) {
          const lower = cleanText.toLowerCase();
          const isCta = ctaKeywords.some((kw) => lower.includes(kw));
          if (isCta) {
            const selector =
              el.tagName.toLowerCase() +
              (el.id ? "#" + el.id : el.className ? "." + el.className.split(" ").filter(Boolean).slice(0, 2).join(".") : "");
            if (!ctas.some((c) => c.text === cleanText)) {
              ctas.push({ text: cleanText, selector });
            }
          }
        }
      }

      const title = document.title || "";
      const descriptionMeta = document.querySelector("meta[name='description']");
      const description = descriptionMeta ? descriptionMeta.getAttribute("content") || "" : "";

      return {
        textBlocks: textBlocks.slice(0, 30),
        ctas: ctas.slice(0, 10),
        title,
        description,
      };
    })()`)) as any;

    logAction("Evidence extraction completed");

    await browser.close();
    logAction("Browser closed successfully");

    return {
      screenshotInitialPath,
      screenshotFullPath,
      sectionScreenshots,
      textBlocks: extractedData.textBlocks,
      ctas: extractedData.ctas,
      title: extractedData.title,
      description: extractedData.description,
      actionLog,
    };
  } catch (error) {
    logAction(`Capture failed with error: ${error}`);
    await browser.close().catch(() => {});
    throw error;
  }
}
