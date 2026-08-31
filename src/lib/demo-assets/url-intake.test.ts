import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import dns from "dns/promises";
import {
  isPrivateIp,
  isPrivateHost,
  fetchWithRedirectSafety,
  extractProductEvidenceFromHtml,
  buildInitialProductBrief,
  normalizeDemoAssetRequest,
} from "./url-intake";

vi.mock("dns/promises", () => ({
  default: {
    resolve: vi.fn(),
    lookup: vi.fn(),
  },
}));

describe("url-intake service", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    (process.env as Record<string, string | undefined>).NODE_ENV = "test";
    process.env.DEMO_ASSETS_ALLOW_LOCAL_FIXTURES = "0";
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("normalizeDemoAssetRequest", () => {
    it("normalizes and returns valid URLs", () => {
      expect(normalizeDemoAssetRequest("http://example.com")).toBe("http://example.com/");
      expect(normalizeDemoAssetRequest("https://example.com/path?query=1")).toBe(
        "https://example.com/path?query=1"
      );
    });

    it("throws error for invalid URLs", () => {
      expect(() => normalizeDemoAssetRequest("not-a-url")).toThrow("INVALID_URL");
      expect(() => normalizeDemoAssetRequest("ftp://example.com")).toThrow("UNSUPPORTED_PROTOCOL");
    });
  });

  describe("isPrivateIp", () => {
    it("detects private and loopback IPv4 addresses", () => {
      expect(isPrivateIp("127.0.0.1")).toBe(true);
      expect(isPrivateIp("127.255.255.255")).toBe(true);
      expect(isPrivateIp("10.0.0.1")).toBe(true);
      expect(isPrivateIp("172.16.4.2")).toBe(true);
      expect(isPrivateIp("172.31.255.255")).toBe(true);
      expect(isPrivateIp("192.168.1.100")).toBe(true);
      expect(isPrivateIp("169.254.10.10")).toBe(true);
      expect(isPrivateIp("0.0.0.0")).toBe(true);
      expect(isPrivateIp("224.0.0.1")).toBe(true);
      expect(isPrivateIp("255.255.255.255")).toBe(true);
    });

    it("approves public IPv4 addresses", () => {
      expect(isPrivateIp("8.8.8.8")).toBe(false);
      expect(isPrivateIp("1.1.1.1")).toBe(false);
      expect(isPrivateIp("172.15.255.255")).toBe(false);
      expect(isPrivateIp("172.32.0.1")).toBe(false);
      expect(isPrivateIp("192.167.0.1")).toBe(false);
    });

    it("detects private and loopback IPv6 addresses", () => {
      expect(isPrivateIp("::1")).toBe(true);
      expect(isPrivateIp("::")).toBe(true);
      expect(isPrivateIp("fc00::1")).toBe(true);
      expect(isPrivateIp("fd99::")).toBe(true);
      expect(isPrivateIp("fe80::1234")).toBe(true);
      expect(isPrivateIp("::ffff:127.0.0.1")).toBe(true);
      expect(isPrivateIp("::ffff:10.0.0.1")).toBe(true);
    });

    it("approves public IPv6 addresses", () => {
      expect(isPrivateIp("2001:db8::1")).toBe(false);
    });

    it("handles malformed IPs safely as private", () => {
      expect(isPrivateIp("not-an-ip")).toBe(true);
      expect(isPrivateIp("300.400.500.600")).toBe(true);
    });
  });

  describe("isPrivateHost", () => {
    it("resolves literal public IPs directly", async () => {
      expect(await isPrivateHost("8.8.8.8")).toBe(false);
      expect(await isPrivateHost("127.0.0.1")).toBe(true);
    });

    it("resolves hostname via DNS A/AAAA records", async () => {
      vi.mocked(dns.resolve).mockResolvedValue(["8.8.8.8", "1.1.1.1"]);
      expect(await isPrivateHost("google.com")).toBe(false);

      vi.mocked(dns.resolve).mockResolvedValue(["8.8.8.8", "127.0.0.1"]);
      expect(await isPrivateHost("malicious.com")).toBe(true);
    });

    it("falls back to dns.lookup when resolve throws", async () => {
      vi.mocked(dns.resolve).mockRejectedValue(new Error("No resolve"));
      vi.mocked(dns.lookup).mockResolvedValue([
        { address: "192.168.1.1", family: 4 }
      ] as unknown as Awaited<ReturnType<typeof dns.lookup>>);
      expect(await isPrivateHost("local.router")).toBe(true);
    });
  });

  describe("fetchWithRedirectSafety", () => {
    it("fetches public URLs successfully", async () => {
      vi.mocked(dns.resolve).mockResolvedValue(["93.184.216.34"]); // example.com IP
      
      const mockResponse = {
        ok: true,
        status: 200,
        text: () => Promise.resolve("<html>Example Page</html>"),
      };
      const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(mockResponse as unknown as Response);

      const html = await fetchWithRedirectSafety("https://example.com");
      expect(html).toBe("<html>Example Page</html>");
      expect(fetchSpy).toHaveBeenCalledWith("https://example.com", expect.any(Object));
    });

    it("rejects local and private literals", async () => {
      await expect(fetchWithRedirectSafety("http://localhost")).rejects.toThrow("FORBIDDEN_HOST");
      await expect(fetchWithRedirectSafety("http://127.0.0.1")).rejects.toThrow("FORBIDDEN_HOST");
      await expect(fetchWithRedirectSafety("http://10.0.0.1")).rejects.toThrow("FORBIDDEN_HOST");
      await expect(fetchWithRedirectSafety("file://etc/passwd")).rejects.toThrow("UNSUPPORTED_PROTOCOL");
      await expect(fetchWithRedirectSafety("javascript:alert(1)")).rejects.toThrow("UNSUPPORTED_PROTOCOL");
    });

    it("rejects non-standard ports", async () => {
      await expect(fetchWithRedirectSafety("http://example.com:8080")).rejects.toThrow("UNSUPPORTED_PORT");
    });

    it("rejects hosts resolving to private IPs", async () => {
      vi.mocked(dns.resolve).mockResolvedValue(["127.0.0.1"]);
      await expect(fetchWithRedirectSafety("http://mocked-local.com")).rejects.toThrow("FORBIDDEN_HOST");
    });

    it("follows redirects safely and rejects private targets", async () => {
      vi.mocked(dns.resolve).mockResolvedValueOnce(["93.184.216.34"]); // public
      
      // Mock first fetch returning 302 redirect
      const mock302Response = {
        status: 302,
        headers: {
          get: (name: string) => (name === "location" ? "http://127.0.0.1/private" : null),
        },
      };
      
      vi.spyOn(global, "fetch").mockResolvedValueOnce(mock302Response as unknown as Response);

      await expect(fetchWithRedirectSafety("https://example.com")).rejects.toThrow("FORBIDDEN_HOST");
    });

    it("enforces max redirect count", async () => {
      vi.mocked(dns.resolve).mockResolvedValue(["93.184.216.34"]); // always public
      
      const mock302Response = {
        status: 302,
        headers: {
          get: (name: string) => (name === "location" ? "https://example.com" : null),
        },
      };

      vi.spyOn(global, "fetch").mockResolvedValue(mock302Response as unknown as Response);

      await expect(fetchWithRedirectSafety("https://example.com")).rejects.toThrow("MAX_REDIRECTS_EXCEEDED");
    });

    it("bypasses localhost checks if allow local fixtures environment is active", async () => {
      process.env.DEMO_ASSETS_ALLOW_LOCAL_FIXTURES = "1";
      
      const mockResponse = {
        ok: true,
        status: 200,
        text: () => Promise.resolve("<html>Local Fixture</html>"),
      };
      vi.spyOn(global, "fetch").mockResolvedValue(mockResponse as unknown as Response);

      // Localhost with non-standard port should pass
      const html = await fetchWithRedirectSafety("http://localhost:8080/fixture");
      expect(html).toBe("<html>Local Fixture</html>");
    });
  });

  describe("extractProductEvidenceFromHtml", () => {
    it("extracts basic metadata and filters CTA keywords", () => {
      const html = `
        <html>
          <head>
            <title>Awesome SaaS Product</title>
            <meta name="description" content="Supercharge your dev workflow with automation.">
            <meta property="og:image" content="https://example.com/logo.png">
          </head>
          <body>
            <h1>Welcome to SaaS</h1>
            <a href="/signup" class="btn-primary">시작하기</a>
            <button>Try For Free</button>
            <button>Ignore me (no keyword)</button>
            <div>가격: 19,000원 또는 $15/월</div>
          </body>
        </html>
      `;

      const evidence = extractProductEvidenceFromHtml(html);

      expect(evidence.title).toBe("Awesome SaaS Product");
      expect(evidence.description).toBe("Supercharge your dev workflow with automation.");
      expect(evidence.ogImage).toBe("https://example.com/logo.png");
      expect(evidence.ctas).toContain("시작하기");
      expect(evidence.ctas).toContain("Try For Free");
      expect(evidence.ctas).not.toContain("Ignore me (no keyword)");
      expect(evidence.pricing).toContain("19,000원");
      expect(evidence.pricing).toContain("$15");
    });
  });

  describe("buildInitialProductBrief", () => {
    const htmlFixture = `
      <html>
        <head>
          <title>Test App</title>
          <meta name="description" content="Nice test description">
        </head>
        <body>
          <button>시작하기</button>
          <div>무료</div>
        </body>
      </html>
    `;

    it("uses extracted HTML data when overrides are not provided", () => {
      const brief = buildInitialProductBrief("https://example.com", htmlFixture);

      expect(brief.productName).toBe("Test App");
      expect(brief.oneLineDescription).toBe("Nice test description");
      expect(brief.cta).toBe("시작하기");
      expect(brief.pricing).toBe("무료");
      expect(brief.landingUrl).toBe("https://example.com");
      expect(brief.brandColors).toEqual({
        primary: "#0F172A",
        secondary: "#6366F1",
      });
    });

    it("prioritizes manual overrides over extracted HTML data", () => {
      const overrides = JSON.stringify({
        productName: "Manual App Name",
        oneLineDescription: "Manual override description",
        targetCustomer: "Indie Hackers",
        offerPromise: "Launch in 5 minutes",
        cta: "Get Started Now",
        primaryColor: "#FF5733",
      });

      const brief = buildInitialProductBrief("https://example.com", htmlFixture, overrides);

      expect(brief.productName).toBe("Manual App Name");
      expect(brief.oneLineDescription).toBe("Manual override description");
      expect(brief.targetCustomer).toBe("Indie Hackers");
      expect(brief.offerPromise).toBe("Launch in 5 minutes");
      expect(brief.cta).toBe("Get Started Now");
      expect(brief.pricing).toBe("무료"); // Falls back to HTML because not overridden
      expect(brief.brandColors).toEqual({
        primary: "#FF5733",
        secondary: "#6366F1",
      });
    });
  });
});
