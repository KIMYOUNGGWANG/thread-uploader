import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { normalizeUrl } from "@/lib/wellness/articles";

/** User-facing scrape failure; the message is shown in the news desk as-is. */
export class ScrapeError extends Error {}

export const MAX_SOURCE_TEXT = 20_000;
const MIN_TEXT = 200;
const MAX_BYTES = 3 * 1024 * 1024;
const TIMEOUT_MS = 10_000;
const MAX_REDIRECTS = 3;

type Resolve = (hostname: string) => Promise<string[]>;
type FetchImpl = (input: string, init: RequestInit) => Promise<Response>;

const resolveAll: Resolve = async (hostname) => (await lookup(hostname, { all: true })).map((entry) => entry.address);

function ipv4Parts(ip: string): number[] | null {
  const parts = ip.split(".").map(Number);
  return parts.length === 4 && parts.every((n) => Number.isInteger(n) && n >= 0 && n <= 255) ? parts : null;
}

/** Loopback, private, link-local (cloud metadata), CGNAT, multicast and reserved ranges, v4 and v6. */
export function isPrivateAddress(ip: string): boolean {
  const v4 = ipv4Parts(ip);
  if (v4) {
    const [a, b] = v4;
    return a === 0 || a === 10 || a === 127 || a >= 224
      || (a === 100 && b >= 64 && b <= 127)
      || (a === 169 && b === 254)
      || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && (b === 168 || (b === 0 && v4[2] === 0)))
      || (a === 198 && (b === 18 || b === 19));
  }
  const v6 = ip.toLowerCase().replace(/^\[|\]$/g, "");
  const mapped = v6.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPrivateAddress(mapped[1]);
  // Other IPv4-in-IPv6 forms (the URL parser rewrites [::ffff:127.0.0.1] to hex ::ffff:7f00:1, IPv4-compatible ::a.b.c.d,
  // NAT64 64:ff9b::) are never a news site and can reach loopback/link-local, so they are refused outright.
  if (v6.startsWith("::") || v6.startsWith("64:ff9b:")) return true;
  return v6 === "::" || v6 === "::1" || /^f[cd]/.test(v6) || /^fe[89ab]/.test(v6) || /^ff/.test(v6);
}

/** Only plain http(s) on default ports whose every resolved address is public. */
export async function assertPublicUrl(raw: string, resolve: Resolve = resolveAll): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new ScrapeError("URL 형식이 아니야.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new ScrapeError("http(s) 주소만 가져올 수 있어.");
  if (url.username || url.password) throw new ScrapeError("계정 정보가 들어간 주소는 못 가져와.");
  if (url.port) throw new ScrapeError("기본 포트(80/443)가 아닌 주소는 못 가져와.");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  let addresses: string[];
  if (isIP(host)) {
    addresses = [host];
  } else {
    try {
      addresses = await resolve(host);
    } catch {
      throw new ScrapeError("주소를 찾을 수 없어 (DNS 실패).");
    }
  }
  if (addresses.length === 0 || addresses.some(isPrivateAddress)) throw new ScrapeError("내부망 주소는 가져올 수 없어.");
  // ponytail: fetch resolves DNS again, so a rebinding host could still swap the address in between; pin the IP if this ever fetches more than operator-pasted URLs
  return url;
}

function charsetFrom(contentType: string | null, head: string): string {
  const fromHeader = contentType?.match(/charset=["']?([\w-]+)/i)?.[1];
  if (fromHeader) return fromHeader;
  return head.match(/<meta[^>]+charset=["']?([\w-]+)/i)?.[1] ?? "utf-8";
}

export function decodeHtml(bytes: Uint8Array, contentType: string | null): string {
  const head = new TextDecoder("latin1").decode(bytes.subarray(0, 4096));
  try {
    return new TextDecoder(charsetFrom(contentType, head)).decode(bytes);
  } catch {
    return new TextDecoder("utf-8").decode(bytes);
  }
}

async function readCapped(response: Response): Promise<Uint8Array> {
  const declared = Number(response.headers.get("content-length") ?? 0);
  if (declared > MAX_BYTES) throw new ScrapeError("페이지가 너무 커 (3MB 초과).");
  if (!response.body) return new Uint8Array();
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BYTES) {
      await reader.cancel();
      throw new ScrapeError("페이지가 너무 커 (3MB 초과).");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

export async function fetchArticleHtml(
  rawUrl: string,
  { fetchImpl = fetch as FetchImpl, resolve = resolveAll }: { fetchImpl?: FetchImpl; resolve?: Resolve } = {},
): Promise<{ html: string; finalUrl: string }> {
  let url = await assertPublicUrl(rawUrl, resolve);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    let response: Response;
    try {
      response = await fetchImpl(url.toString(), {
        redirect: "manual",
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { "user-agent": "Mozilla/5.0 (compatible; NewsDeskBot/1.0)", accept: "text/html,application/xhtml+xml" },
      });
    } catch {
      throw new ScrapeError("기사 페이지에 접속하지 못했어 (시간 초과 또는 연결 실패).");
    }
    const location = response.headers.get("location");
    if (response.status >= 300 && response.status < 400 && location) {
      url = await assertPublicUrl(new URL(location, url).toString(), resolve);
      continue;
    }
    if (!response.ok) throw new ScrapeError(`기사 페이지를 못 열었어 (HTTP ${response.status}).`);
    const contentType = response.headers.get("content-type");
    if (!/html/i.test(contentType ?? "")) throw new ScrapeError("HTML 페이지가 아니야.");
    return { html: decodeHtml(await readCapped(response), contentType), finalUrl: url.toString() };
  }
  throw new ScrapeError("리다이렉트가 너무 많아.");
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", middot: "·", hellip: "…", lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”" };

function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, code: string) => {
    if (code[0] === "#") {
      const n = code[1] === "x" || code[1] === "X" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : whole;
    }
    return ENTITIES[code.toLowerCase()] ?? whole;
  });
}

function cleanText(fragment: string): string {
  return decodeEntities(fragment.replace(/<[^>]+>/g, " ")).replace(/\u0000/g, "").replace(/\s+/g, " ").trim();
}

function metaContent(html: string, key: string): string | null {
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const name = tag.match(/\b(?:property|name)=["']([^"']+)["']/i)?.[1];
    if (name?.toLowerCase() !== key) continue;
    const content = tag.match(/\bcontent=["']([^"']*)["']/i)?.[1];
    if (content) return cleanText(content);
  }
  return null;
}

const NOISE = /<(script|style|noscript|svg|iframe|template|nav|header|footer|aside|form|figcaption)\b[\s\S]*?<\/\1>/gi;
const SENTENCE_LINE = 40;

export interface ExtractedArticle {
  title: string;
  description: string | null;
  imageUrl: string | null;
  text: string;
}

export function extractArticle(html: string): ExtractedArticle {
  const title = metaContent(html, "og:title") ?? metaContent(html, "twitter:title") ?? cleanText(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "");
  const description = metaContent(html, "og:description");
  const image = metaContent(html, "og:image");
  const imageUrl = image && /^https?:\/\//i.test(image) ? image : null;

  const stripped = html.replace(/<!--[\s\S]*?-->/g, " ").replace(NOISE, " ");
  const articles = stripped.match(/<article\b[\s\S]*?<\/article>/gi) ?? [];
  const region = articles.sort((a, b) => b.length - a.length)[0] ?? stripped.match(/<body\b[\s\S]*<\/body>/i)?.[0] ?? stripped;

  const paragraphs = (region.match(/<p\b[^>]*>[\s\S]*?<\/p>/gi) ?? []).map(cleanText).filter(Boolean);
  let text = paragraphs.join("\n\n");
  if (text.length < MIN_TEXT) {
    // Many Korean news CMSes put the body in one div separated by <br>: keep sentence-length lines only.
    const lines = region
      .replace(/<br\s*\/?>|<\/(div|p|li|h\d|tr|section)>/gi, "\n")
      .split("\n")
      .map(cleanText)
      .filter((line) => line.length >= SENTENCE_LINE);
    if (lines.join("").length > text.length) text = lines.join("\n\n");
  }
  return { title, description, imageUrl, text: text.slice(0, MAX_SOURCE_TEXT) };
}

export interface ScrapedArticle extends ExtractedArticle {
  url: string;
}

export async function scrapeArticle(rawUrl: string): Promise<ScrapedArticle> {
  const { html, finalUrl } = await fetchArticleHtml(rawUrl);
  const article = extractArticle(html);
  if (article.text.length < MIN_TEXT) throw new ScrapeError("본문을 못 읽었어. 원문을 붙여넣어 줘.");
  return { ...article, url: normalizeUrl(finalUrl) };
}
