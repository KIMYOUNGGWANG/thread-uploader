import dns from "dns/promises";
import net from "net";

export interface ProductBrief {
  productName: string;
  oneLineDescription: string;
  targetCustomer: string;
  offerPromise: string;
  landingUrl: string;
  cta: string;
  pricing: string;
  brandColors: {
    primary: string;
    secondary: string;
  };
}

export function shouldBypassLocalhost(): boolean {
  return (
    process.env.NODE_ENV !== "production" &&
    (process.env.DEMO_ASSETS_ALLOW_LOCAL_FIXTURES === "1" || process.env.DEMO_ASSETS_ALLOW_LOCAL_FIXTURES === "true")
  );
}

export function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const parts = ip.split(".").map(Number);
    if (parts.length !== 4 || parts.some(isNaN)) return true;
    const [a, b, c, d] = parts;
    // Loopback
    if (a === 127) return true;
    // Private ranges
    if (a === 10) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    // Link-local
    if (a === 169 && b === 254) return true;
    // Unspecified / broadcast
    if (a === 0 || a >= 224) return true;
    return false;
  } else if (net.isIPv6(ip)) {
    const normalized = ip.toLowerCase().trim();
    if (normalized === "::1" || normalized === "::") return true;
    // Unique local address (fc00::/7)
    if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
    // Link-local (fe80::/10)
    if (/^fe[89ab]/i.test(normalized)) return true;
    // IPv4-mapped IPv6
    if (normalized.startsWith("::ffff:")) {
      const ipv4Part = ip.substring(7);
      if (net.isIPv4(ipv4Part)) {
        return isPrivateIp(ipv4Part);
      }
    }
    return false;
  }
  return true;
}

export async function isPrivateHost(host: string): Promise<boolean> {
  if (shouldBypassLocalhost() && host.toLowerCase() === "localhost") {
    return false;
  }
  if (net.isIP(host)) {
    if (shouldBypassLocalhost() && (host === "127.0.0.1" || host === "::1")) {
      return false;
    }
    return isPrivateIp(host);
  }
  try {
    const addresses = await dns.resolve(host).catch(async () => {
      const lookupResult = await dns.lookup(host, { all: true });
      return lookupResult.map((r) => r.address);
    });
    for (const addr of addresses) {
      if (shouldBypassLocalhost() && (addr === "127.0.0.1" || addr === "::1")) {
        continue;
      }
      if (isPrivateIp(addr)) {
        return true;
      }
    }
  } catch (err) {
    return true; // DNS resolution failure -> unsafe
  }
  return false;
}

export async function fetchWithRedirectSafety(urlStr: string, redirectCount = 0): Promise<string> {
  if (redirectCount > 3) {
    throw new Error("MAX_REDIRECTS_EXCEEDED");
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(urlStr);
  } catch (err) {
    throw new Error("INVALID_URL");
  }

  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    throw new Error("UNSUPPORTED_PROTOCOL");
  }

  const port = parsedUrl.port;
  if (port) {
    const portNum = Number(port);
    const isDefaultPort =
      (parsedUrl.protocol === "http:" && portNum === 80) ||
      (parsedUrl.protocol === "https:" && portNum === 443);
    if (!isDefaultPort && !shouldBypassLocalhost()) {
      throw new Error("UNSUPPORTED_PORT");
    }
  }

  const host = parsedUrl.hostname;
  if (!host) {
    throw new Error("INVALID_HOST");
  }

  const isPrivate = await isPrivateHost(host);
  if (isPrivate) {
    throw new Error("FORBIDDEN_HOST");
  }


  const response = await fetch(urlStr, {
    redirect: "manual",
    headers: {
      "User-Agent":
        "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1",
    },
  });

  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get("location");
    if (!location) {
      throw new Error("REDIRECT_MISSING_LOCATION");
    }
    const absoluteLocation = new URL(location, urlStr).toString();
    return fetchWithRedirectSafety(absoluteLocation, redirectCount + 1);
  }

  if (!response.ok) {
    throw new Error(`FETCH_FAILED_STATUS_${response.status}`);
  }

  return response.text();
}

export function extractProductEvidenceFromHtml(html: string): {
  title: string;
  description: string;
  ogImage: string;
  ctas: string[];
  pricing: string[];
} {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? titleMatch[1].replace(/<[^>]*>/g, "").trim() : "";

  const extractMeta = (nameOrProperty: string): string => {
    const rx = new RegExp(
      `<meta\\s+(?:[^>]*?\\s+)?(?:name|property)=["']${nameOrProperty}["']\\s+(?:[^>]*?\\s+)?content=["']([^"']+)["']`,
      "i"
    );
    const match = html.match(rx);
    if (match) return match[1].trim();

    const rxRev = new RegExp(
      `<meta\\s+(?:[^>]*?\\s+)?content=["']([^"']+)["']\\s+(?:[^>]*?\\s+)?(?:name|property)=["']${nameOrProperty}["']`,
      "i"
    );
    const matchRev = html.match(rxRev);
    return matchRev ? matchRev[1].trim() : "";
  };

  const description = extractMeta("description") || extractMeta("og:description");
  const ogImage = extractMeta("og:image");

  const ctas: string[] = [];
  const tagRx = /<(button|a)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  let match;
  const ctaKeywords = [
    "시작", "가입", "구매", "다운로드", "체험", "로그인", "등록", "받기", "구독",
    "start", "try", "buy", "join", "sign up", "download", "free", "get", "subscribe", "login"
  ];

  while ((match = tagRx.exec(html)) !== null) {
    const rawText = match[2].replace(/<[^>]*>/g, "").trim();
    const cleanText = rawText.replace(/\s+/g, " ");
    if (cleanText.length >= 2 && cleanText.length <= 25) {
      const lower = cleanText.toLowerCase();
      const hasKeyword = ctaKeywords.some((kw) => lower.includes(kw));
      if (hasKeyword && !ctas.includes(cleanText)) {
        ctas.push(cleanText);
      }
    }
  }

  const pricing: string[] = [];
  const priceRx = /(?:\$\s*\d+(?:\.\d{2})?|\b\d{1,3}(?:,\d{3})*\s*원|free\b|무료)/gi;
  let prMatch;
  while ((prMatch = priceRx.exec(html)) !== null) {
    const cleanPrice = prMatch[0].trim();
    if (!pricing.includes(cleanPrice)) {
      pricing.push(cleanPrice);
    }
  }

  return {
    title,
    description,
    ogImage,
    ctas: ctas.slice(0, 5),
    pricing: pricing.slice(0, 5),
  };
}

export function buildInitialProductBrief(
  url: string,
  html: string,
  overridesJson?: string
): ProductBrief {
  const extracted = extractProductEvidenceFromHtml(html);

  let overrides: Record<string, unknown> = {};
  if (overridesJson) {
    try {
      overrides = JSON.parse(overridesJson);
    } catch (err) {
      // Ignore malformed override JSON
    }
  }

  const productName = (overrides.productName as string) || extracted.title || "Untitled Product";
  const oneLineDescription =
    (overrides.oneLineDescription as string) || extracted.description || "";
  const targetCustomer = (overrides.targetCustomer as string) || "";
  const offerPromise = (overrides.offerPromise as string) || "";
  const landingUrl = url;
  const cta = (overrides.cta as string) || extracted.ctas[0] || "Learn More";
  const pricing = (overrides.pricing as string) || extracted.pricing[0] || "Free Trial";

  const brandColors = {
    primary: (overrides.primaryColor as string) || "#0F172A",
    secondary: (overrides.secondaryColor as string) || "#6366F1",
  };

  return {
    productName,
    oneLineDescription,
    targetCustomer,
    offerPromise,
    landingUrl,
    cta,
    pricing,
    brandColors,
  };
}

export function normalizeDemoAssetRequest(urlStr: string): string {
  let parsed: URL;
  try {
    parsed = new URL(urlStr);
  } catch (err) {
    throw new Error("INVALID_URL");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("UNSUPPORTED_PROTOCOL");
  }
  return parsed.toString();
}
