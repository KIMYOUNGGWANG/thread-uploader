// src/app/api/tiktok/tiktok-routes.test.ts — Unit tests for TikTok API routes.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { POST as generateHandler } from "./generate/route";
import { GET as draftsHandler } from "./drafts/route";
import { POST as renderHandler } from "./render/route";
import { prisma } from "@/lib/prisma";
import { ForbiddenError, requireBrandForCurrentUser } from "@/lib/brand-access";
import { generateTikTokScript } from "@/lib/tiktok/tiktok-script-engine";
import { getDomainPreset } from "@/lib/domain-registry";

const messagesCreate = vi.hoisted(() => vi.fn());
vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = { create: messagesCreate };
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    brand: {
      findUnique: vi.fn(),
    },
    tikTokVideoDraft: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("@/lib/brand-access", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/brand-access")>();
  return { ...actual, requireBrandForCurrentUser: vi.fn() };
});

describe("TikTok API Routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireBrandForCurrentUser).mockImplementation(async (brandId: string) => ({
      user: { id: "user-1", email: "owner@example.com", name: null },
      brand: { id: brandId, name: "사주브랜드", slug: "cosmicpath", brandConfig: "{}" } as Awaited<ReturnType<typeof requireBrandForCurrentUser>>["brand"],
    }));
  });

  describe("brand ownership", () => {
    it("requires brandId instead of listing every brand's drafts", async () => {
      const res = await draftsHandler(new Request("http://localhost/api/tiktok/drafts") as never);
      expect(res.status).toBe(400);
    });

    it("returns 403 for drafts of a brand the user does not own", async () => {
      vi.mocked(requireBrandForCurrentUser).mockRejectedValueOnce(new ForbiddenError());
      const res = await draftsHandler(new Request("http://localhost/api/tiktok/drafts?brandId=other") as never);
      expect(res.status).toBe(403);
    });

    it("returns 403 when rendering a draft of another brand", async () => {
      vi.mocked(prisma.tikTokVideoDraft.findUnique).mockResolvedValue({ id: "d1", brandId: "other" } as never);
      vi.mocked(requireBrandForCurrentUser).mockRejectedValueOnce(new ForbiddenError());
      const res = await renderHandler(new Request("http://localhost/api/tiktok/render", {
        method: "POST",
        body: JSON.stringify({ draftId: "d1" }),
      }) as never);
      expect(res.status).toBe(403);
    });
  });

  describe("POST /api/tiktok/generate", () => {
    it("returns 400 if brandId is missing", async () => {
      const req = new Request("http://localhost/api/tiktok/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      const res = await generateHandler(req as never);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain("brandId is required");
    });

    it("creates and returns a new draft when brand exists", async () => {
      vi.mocked(prisma.brand.findUnique).mockResolvedValue({
        id: "brand-123",
        name: "사주브랜드",
      } as never);

      vi.mocked(prisma.tikTokVideoDraft.create).mockImplementation(
        (async ({ data }: { data: Record<string, unknown> }) => ({ id: "draft-456", ...data })) as never
      );

      const req = new Request("http://localhost/api/tiktok/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brandId: "brand-123",
          dayMaster: "갑목",
          topic: "재물운",
        }),
      });

      const res = await generateHandler(req as never);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.draft.id).toBe("draft-456");
      expect(data.draft.title).toContain("갑목");
      expect(data.scriptResult.scenes.length).toBe(4);
    });
  });

  describe("POST /api/tiktok/generate per brand engine", () => {
    type Brand = Awaited<ReturnType<typeof requireBrandForCurrentUser>>["brand"];
    function asBrand(slug: string, name: string, brandConfig: object) {
      vi.mocked(requireBrandForCurrentUser).mockResolvedValue({
        user: { id: "user-1", email: "owner@example.com", name: null },
        brand: { id: `b-${slug}`, name, slug, brandConfig: JSON.stringify(brandConfig) } as Brand,
      });
    }
    function generate(body: object) {
      return generateHandler(new Request("http://localhost/api/tiktok/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }) as never);
    }

    beforeEach(() => {
      messagesCreate.mockReset();
      vi.mocked(prisma.tikTokVideoDraft.create).mockImplementation(
        (async ({ data }: { data: Record<string, unknown> }) => ({ id: "draft-new", ...data })) as never
      );
    });
    afterEach(() => vi.unstubAllEnvs());

    it("generates a product script for a product_growth brand", async () => {
      vi.stubEnv("ANTHROPIC_API_KEY", "");
      asBrand("catchdex", "Catchdex", { qualityProfile: "product_growth", productProfile: { productName: "Catchdex" } });
      const res = await generate({ brandId: "b-catchdex", dayMaster: "갑목", topic: "" });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.scriptResult.scenes[1].spokenLine).toContain("Catchdex");
      expect(data.scriptResult.scenes.some((s: { type: string }) => s.type === "saju-card")).toBe(false);
      expect(data.draft.title).not.toContain("갑목");
      expect(data.draft.campaignId).toBe("product_tiktok_campaign");
    });

    it("falls back to the preset topic for a blank topic and ignores an unknown tone", async () => {
      vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
      messagesCreate.mockResolvedValueOnce({ content: [{ type: "text", text: "nope" }], stop_reason: "end_turn" });
      asBrand("catchdex", "Catchdex", { qualityProfile: "product_growth" });
      await generate({ brandId: "b-catchdex", topic: "   ", tone: "foo" });
      const prompt = messagesCreate.mock.calls[0][0].messages[0].content as string;
      expect(prompt).toContain(`주제: ${getDomainPreset("product_growth").defaultTopics[0]}`);
      expect(prompt).not.toContain("undefined");
    });

    it("keeps cosmicpath-global on the English saju script", async () => {
      asBrand("cosmicpath-global", "CosmicPath Global", { qualityProfile: "ecommerce_d2c" });
      const res = await generate({ brandId: "b-cosmicpath-global", dayMaster: "갑목" });
      const data = await res.json();
      expect(data.scriptResult).toEqual(generateTikTokScript({ topic: "사주 대운 분석", dayMaster: "갑목", tone: "mysterious", lang: "en" }));
      expect(data.draft.campaignId).toBe("saju_tiktok_campaign");
    });

    it("returns 500 and saves nothing when Claude returns garbage", async () => {
      vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
      messagesCreate.mockResolvedValueOnce({ content: [{ type: "text", text: "nope" }], stop_reason: "end_turn" });
      asBrand("catchdex", "Catchdex", { qualityProfile: "product_growth" });
      const res = await generate({ brandId: "b-catchdex" });
      expect(res.status).toBe(500);
      expect(prisma.tikTokVideoDraft.create).not.toHaveBeenCalled();
    });
  });

  describe("GET /api/tiktok/drafts", () => {
    it("fetches drafts for a given brandId", async () => {
      vi.mocked(prisma.tikTokVideoDraft.findMany).mockResolvedValue([
        { id: "draft-1", title: "사주 숏폼 1", status: "DRAFT" },
      ] as never);

      const req = new Request("http://localhost/api/tiktok/drafts?brandId=brand-123", {
        method: "GET",
      });

      const res = await draftsHandler(req as never);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.drafts.length).toBe(1);
      expect(data.drafts[0].title).toBe("사주 숏폼 1");
    });
  });

  describe("POST /api/tiktok/render", () => {
    it("renders a draft with dryRun=true and marks as COMPLETED", async () => {
      const mockScenes = [
        {
          sceneId: "scene-01",
          durationSeconds: 3.5,
          type: "kinetic-card",
          spokenLine: "주목하세요",
          onScreenText: ["주목"],
        },
      ];

      vi.mocked(prisma.tikTokVideoDraft.findUnique).mockResolvedValue({
        id: "draft-789",
        title: "테스트 영상",
        spokenHook: "주목하세요",
        script: "주목하세요 전체 대본",
        durationSeconds: 15,
        sceneBeats: JSON.stringify(mockScenes),
        hashtags: JSON.stringify(["사주"]),
        cta: "확인해보세요",
        qualityScore: 90,
        qualityPass: true,
      } as never);

      vi.mocked(prisma.tikTokVideoDraft.update).mockImplementation(
        (async ({ data }: { data: Record<string, unknown> }) => ({ id: "draft-789", ...data })) as never
      );

      const req = new Request("http://localhost/api/tiktok/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draftId: "draft-789", dryRun: true }),
      });

      const res = await renderHandler(req as never);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.draft.status).toBe("COMPLETED");
      expect(data.renderResult.success).toBe(true);
    });

    it("queues a draft with dryRun=false and returns 202 Accepted for worker processing", async () => {
      vi.mocked(prisma.tikTokVideoDraft.findUnique).mockResolvedValue({
        id: "draft-async-1",
        title: "비동기 테스트 영상",
        spokenHook: "주목하세요",
        script: "대본 내용",
        durationSeconds: 20,
        sceneBeats: JSON.stringify([]),
        hashtags: JSON.stringify([]),
        cta: "확인하세요",
      } as never);

      vi.mocked(prisma.tikTokVideoDraft.update).mockImplementation(
        (async ({ data }: { data: Record<string, unknown> }) => ({ id: "draft-async-1", ...data })) as never
      );

      const req = new Request("http://localhost/api/tiktok/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draftId: "draft-async-1", dryRun: false }),
      });

      const res = await renderHandler(req as never);
      expect(res.status).toBe(202);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.queued).toBe(true);
      expect(data.draft.status).toBe("QUEUED");
      expect(data.message).toContain("백그라운드 큐");
    });
  });
});
