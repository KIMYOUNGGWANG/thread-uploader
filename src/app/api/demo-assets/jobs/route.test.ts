import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const prismaMocks = vi.hoisted(() => ({
  createJob: vi.fn(),
  findManyJobs: vi.fn(),
  findUniqueJob: vi.fn(),
  updateJob: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    demoAssetJob: {
      create: prismaMocks.createJob,
      findMany: prismaMocks.findManyJobs,
      findUnique: prismaMocks.findUniqueJob,
      update: prismaMocks.updateJob,
    },
  },
}));

const accessMocks = vi.hoisted(() => ({
  requireBrandForCurrentUser: vi.fn(),
  requireDemoAssetJobForCurrentUser: vi.fn(),
}));

vi.mock("@/lib/brand-access", () => ({
  accessErrorResponse: () => null,
  requireBrandForCurrentUser: accessMocks.requireBrandForCurrentUser,
  requireDemoAssetJobForCurrentUser: accessMocks.requireDemoAssetJobForCurrentUser,
}));

vi.mock("@/lib/demo-assets/url-intake", () => ({
  normalizeDemoAssetRequest: (url: string) => {
    if (url === "invalid-url") throw new Error("INVALID_URL");
    return url;
  },
  isPrivateHost: async (host: string) => {
    return host === "localhost" || host === "127.0.0.1";
  },
  shouldBypassLocalhost: () => false,
}));

function jsonRequest(url: string, method: string, body?: unknown): NextRequest {
  return new NextRequest(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe("Demo Asset Jobs API Endpoints", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("POST /api/demo-assets/jobs", () => {
    it("creates a job successfully and returns 202", async () => {
      const { POST } = await import("./route");

      accessMocks.requireBrandForCurrentUser.mockResolvedValue({
        brand: { id: "brand_123", name: "Test Brand" },
      });

      prismaMocks.createJob.mockResolvedValue({
        id: "job_789",
        brandId: "brand_123",
        productUrl: "https://example.com",
        style: "clean-product-demo",
        videoCount: 3,
        imageCount: 6,
        status: "QUEUED",
      });

      const response = await POST(
        jsonRequest("http://localhost/api/demo-assets/jobs", "POST", {
          brandId: "brand_123",
          productUrl: "https://example.com",
          style: "clean-product-demo",
          videoCount: 3,
          imageCount: 6,
        })
      );

      expect(response.status).toBe(202);
      const data = await response.json();
      expect(data.id).toBe("job_789");
      expect(data.status).toBe("QUEUED");
      expect(accessMocks.requireBrandForCurrentUser).toHaveBeenCalledWith("brand_123");
      expect(prismaMocks.createJob).toHaveBeenCalledWith({
        data: expect.objectContaining({
          brandId: "brand_123",
          productUrl: "https://example.com",
          style: "clean-product-demo",
          videoCount: 3,
          imageCount: 6,
          status: "QUEUED",
        }),
      });
    });

    it("rejects request if brandId or productUrl is missing", async () => {
      const { POST } = await import("./route");

      const res1 = await POST(
        jsonRequest("http://localhost/api/demo-assets/jobs", "POST", {
          productUrl: "https://example.com",
        })
      );
      expect(res1.status).toBe(400);

      const res2 = await POST(
        jsonRequest("http://localhost/api/demo-assets/jobs", "POST", {
          brandId: "brand_123",
        })
      );
      expect(res2.status).toBe(400);
    });

    it("rejects request if URL is invalid", async () => {
      const { POST } = await import("./route");

      accessMocks.requireBrandForCurrentUser.mockResolvedValue({
        brand: { id: "brand_123" },
      });

      const response = await POST(
        jsonRequest("http://localhost/api/demo-assets/jobs", "POST", {
          brandId: "brand_123",
          productUrl: "invalid-url",
        })
      );

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain("Invalid product URL");
    });

    it("rejects request if URL resolves to private host", async () => {
      const { POST } = await import("./route");

      accessMocks.requireBrandForCurrentUser.mockResolvedValue({
        brand: { id: "brand_123" },
      });

      const response = await POST(
        jsonRequest("http://localhost/api/demo-assets/jobs", "POST", {
          brandId: "brand_123",
          productUrl: "http://localhost",
        })
      );

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain("Private or local URLs are forbidden");
    });
  });

  describe("GET /api/demo-assets/jobs", () => {
    it("returns jobs for a brand", async () => {
      const { GET } = await import("./route");

      accessMocks.requireBrandForCurrentUser.mockResolvedValue({
        brand: { id: "brand_123" },
      });

      prismaMocks.findManyJobs.mockResolvedValue([
        { id: "job_1", brandId: "brand_123", status: "READY" },
        { id: "job_2", brandId: "brand_123", status: "QUEUED" },
      ]);

      const response = await GET(
        new NextRequest("http://localhost/api/demo-assets/jobs?brandId=brand_123")
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toHaveLength(2);
      expect(data[0].id).toBe("job_1");
    });

    it("rejects if brandId query param is missing", async () => {
      const { GET } = await import("./route");

      const response = await GET(new NextRequest("http://localhost/api/demo-assets/jobs"));
      expect(response.status).toBe(400);
    });
  });

  describe("GET /api/demo-assets/jobs/[id]", () => {
    it("returns job details", async () => {
      const { GET } = await import("./[id]/route");

      accessMocks.requireDemoAssetJobForCurrentUser.mockResolvedValue({
        job: { id: "job_123" },
      });

      prismaMocks.findUniqueJob.mockResolvedValue({
        id: "job_123",
        brandId: "brand_1",
        status: "READY",
        captureArtifacts: [],
        renderedAssets: [],
      });

      const response = await GET(
        new NextRequest("http://localhost/api/demo-assets/jobs/job_123"),
        { params: Promise.resolve({ id: "job_123" }) }
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.id).toBe("job_123");
      expect(data.status).toBe("READY");
    });
  });

  describe("POST /api/demo-assets/jobs/[id]/regenerate", () => {
    it("resets job status to QUEUED and returns updated job", async () => {
      const { POST } = await import("./[id]/regenerate/route");

      accessMocks.requireDemoAssetJobForCurrentUser.mockResolvedValue({
        job: { id: "job_123" },
      });

      prismaMocks.updateJob.mockResolvedValue({
        id: "job_123",
        status: "QUEUED",
        lockedBy: null,
        lockedAt: null,
        heartbeatAt: null,
        attemptCount: 0,
        errorReason: null,
      });

      const response = await POST(
        jsonRequest("http://localhost/api/demo-assets/jobs/job_123/regenerate", "POST"),
        { params: Promise.resolve({ id: "job_123" }) }
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.id).toBe("job_123");
      expect(data.status).toBe("QUEUED");
      expect(prismaMocks.updateJob).toHaveBeenCalledWith({
        where: { id: "job_123" },
        data: {
          status: "QUEUED",
          lockedBy: null,
          lockedAt: null,
          heartbeatAt: null,
          attemptCount: 0,
          errorReason: null,
        },
      });
    });
  });
});
