/**
 * Bot and Crawler Detection Utility for Clean Attribution
 *
 * Filters out link preview scrapers, search engine crawlers, and automated bots
 * so that /r/[code] redirect click counts reflect genuine human interactions.
 */

const BOT_USER_AGENT_PATTERNS: readonly RegExp[] = [
  // Social Platform Link Preview Crawlers
  /facebookexternalhit/i,
  /Facebot/i,
  /meta-externalagent/i,
  /Instagram/i,
  /Twitterbot/i,
  /LinkedInBot/i,
  /Slackbot/i,
  /Discordbot/i,
  /TelegramBot/i,
  /WhatsApp/i,
  /Pinterest/i,
  /SkypeUriPreview/i,

  // Search Engine Crawlers
  /Googlebot/i,
  /Google-InspectionTool/i,
  /bingbot/i,
  /Baiduspider/i,
  /YandexBot/i,
  /DuckDuckBot/i,
  /Sogou/i,
  /Applebot/i,

  // Generic Scrapers & Automated HTTP Clients
  /curl\//i,
  /Wget\//i,
  /python-requests/i,
  /node-fetch/i,
  /axios\//i,
  /Go-http-client/i,
  /Java\//i,
  /Apache-HttpClient/i,
  /postman/i,
  /HeadlessChrome/i,
  /PhantomJS/i,
  /Bytespider/i,
  /bot\b/i,
  /crawler\b/i,
  /spider\b/i,
];

/**
 * Returns true if the given User-Agent string belongs to an automated crawler or bot.
 */
export function isBotUserAgent(userAgent: string | null | undefined): boolean {
  if (!userAgent || typeof userAgent !== "string") {
    // Empty User-Agent on web requests is almost always an automated script
    return true;
  }

  const trimmed = userAgent.trim();
  if (trimmed.length === 0) return true;

  return BOT_USER_AGENT_PATTERNS.some((pattern) => pattern.test(trimmed));
}
