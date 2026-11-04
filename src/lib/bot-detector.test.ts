import { describe, expect, it } from "vitest";
import { isBotUserAgent } from "./bot-detector";

describe("bot-detector", () => {
  it("detects social preview scrapers as bots", () => {
    expect(isBotUserAgent("facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)")).toBe(true);
    expect(isBotUserAgent("Facebot")).toBe(true);
    expect(isBotUserAgent("Twitterbot/1.0")).toBe(true);
    expect(isBotUserAgent("LinkedInBot/1.0 (compatible; Mozilla/5.0; Apache-HttpClient +http://www.linkedin.com)")).toBe(true);
    expect(isBotUserAgent("Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)")).toBe(true);
    expect(isBotUserAgent("TelegramBot (like TwitterBot)")).toBe(true);
  });

  it("detects search engines and scrapers as bots", () => {
    expect(isBotUserAgent("Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)")).toBe(true);
    expect(isBotUserAgent("Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)")).toBe(true);
    expect(isBotUserAgent("curl/7.88.1")).toBe(true);
    expect(isBotUserAgent("python-requests/2.31.0")).toBe(true);
    expect(isBotUserAgent("axios/1.6.2")).toBe(true);
  });

  it("identifies genuine human mobile and desktop browsers as non-bots", () => {
    const iphoneSafari = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1";
    const androidChrome = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36";
    const macChrome = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36";

    expect(isBotUserAgent(iphoneSafari)).toBe(false);
    expect(isBotUserAgent(androidChrome)).toBe(false);
    expect(isBotUserAgent(macChrome)).toBe(false);
  });

  it("counts Instagram, Threads and Pinterest in-app browsers as humans", () => {
    const instagramIos = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/21E236 Instagram 323.0.3.23.54 (iPhone15,2; iOS 17_4; ko_KR; ko; scale=3.00; 1179x2556; 580117040)";
    const instagramAndroid = "Mozilla/5.0 (Linux; Android 14; SM-S918N Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/124.0.6367.82 Mobile Safari/537.36 Instagram 329.0.0.41.93 Android (34/14; 480dpi; 1080x2340; samsung; SM-S918N; dm3q; qcom; ko_KR; 591192899)";
    const threadsIos = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/21E236 Barcelona 323.0.3.23.54 (iPhone15,2; iOS 17_4; ko_KR; ko; scale=3.00; 1179x2556; 580117040)";
    const pinterestApp = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [Pinterest/iOS]";

    expect(isBotUserAgent(instagramIos)).toBe(false);
    expect(isBotUserAgent(instagramAndroid)).toBe(false);
    expect(isBotUserAgent(threadsIos)).toBe(false);
    expect(isBotUserAgent(pinterestApp)).toBe(false);
    expect(isBotUserAgent("Pinterestbot/1.0 (+http://www.pinterest.com/bot.html)")).toBe(true);
    expect(isBotUserAgent("meta-externalagent/1.1 (+https://developers.facebook.com/docs/sharing/webmasters/crawler)")).toBe(true);
  });

  it("treats null, undefined, or empty User-Agent as bot", () => {
    expect(isBotUserAgent(null)).toBe(true);
    expect(isBotUserAgent(undefined)).toBe(true);
    expect(isBotUserAgent("")).toBe(true);
    expect(isBotUserAgent("   ")).toBe(true);
  });
});
