// scripts/render-tiktok-worker.test.ts — Unit tests for TikTok CLI render worker.
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  buildTikTokRenderSpec,
  cleanStaleJobs,
  processNextJob,
} from "./render-tiktok-worker.mjs";

describe("TikTok Render Worker", () => {
  describe("buildTikTokRenderSpec", () => {
    it("assembles a 9:16 vertical render spec from script scenes", () => {
      const scriptResult = {
        title: "을목 재물운",
        spokenHook: "을목 일주 필독",
        fullScript: "을목 일주 분들은 올해 재물 흐름이 바뀝니다.",
        totalDurationSeconds: 15,
        scenes: [
          {
            sceneId: "s1",
            durationSeconds: 3.5,
            type: "kinetic-card",
            spokenLine: "을목 일주 필독",
            onScreenText: ["을목 일주"],
            visualProps: {
              hookText: "을목 일주 주목",
              subText: "2026 재물 흐름",
              badge: "사주 분석",
            },
          },
          {
            sceneId: "s2",
            durationSeconds: 4.0,
            type: "saju-card",
            spokenLine: "오행의 기운이 변합니다",
            onScreenText: ["오행 변화"],
            visualProps: {
              sajuData: { dayMaster: "을목" },
            },
          },
        ],
        cta: "프로필 확인",
      };

      const spec = buildTikTokRenderSpec(scriptResult as never);

      expect(spec.compositor).toBe("remotion");
      expect(spec.composition).toBe("TikTokExplainer");
      expect(spec.fps).toBe(30);
      expect(spec.dimensions).toEqual({ width: 1080, height: 1920 });
      expect(spec.scenes.length).toBe(2);
      expect(spec.scenes[0].visual.type).toBe("kinetic-card");
      expect(spec.scenes[1].visual.type).toBe("saju-card");
    });
  });

  describe("cleanStaleJobs", () => {
    it("recovers stale RENDERING drafts older than 10 minutes", async () => {
      const mockUpdate = vi.fn().mockResolvedValue({});
      const mockFindMany = vi.fn().mockResolvedValue([
        { id: "draft-stale-1", title: "멈춘 영상 1" },
        { id: "draft-stale-2", title: "멈춘 영상 2" },
      ]);

      const mockDb = {
        tikTokVideoDraft: {
          findMany: mockFindMany,
          update: mockUpdate,
        },
      };

      const cleanedCount = await cleanStaleJobs(mockDb as never, 10 * 60 * 1000);

      expect(cleanedCount).toBe(2);
      expect(mockUpdate).toHaveBeenCalledTimes(2);
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "draft-stale-1" },
          data: expect.objectContaining({ status: "FAILED" }),
        })
      );
    });

    it("returns 0 if no stale drafts found", async () => {
      const mockDb = {
        tikTokVideoDraft: {
          findMany: vi.fn().mockResolvedValue([]),
        },
      };

      const cleanedCount = await cleanStaleJobs(mockDb as never);
      expect(cleanedCount).toBe(0);
    });
  });

  describe("processNextJob", () => {
    it("claims next QUEUED job and marks as COMPLETED in dryRun mode", async () => {
      const mockDraft = {
        id: "draft-q-1",
        title: "대기 중인 영상",
        spokenHook: "후킹 대사",
        script: "전체 대본",
        durationSeconds: 10,
        sceneBeats: JSON.stringify([
          {
            sceneId: "scene-1",
            durationSeconds: 3,
            type: "kinetic-card",
            spokenLine: "후킹",
          },
        ]),
        cta: "댓글 남기기",
      };

      const mockFind = vi.fn().mockResolvedValue(mockDraft);
      const mockUpdate = vi.fn().mockResolvedValue({ ...mockDraft, status: "COMPLETED" });

      const mockDb = {
        tikTokVideoDraft: {
          findFirst: mockFind,
          update: mockUpdate,
        },
      };

      const result = await processNextJob(mockDb as never, { dryRun: true });

      expect(result).not.toBeNull();
      expect(result?.success).toBe(true);
      expect(result?.draftId).toBe("draft-q-1");

      // Claimed RENDERING first, then COMPLETED
      expect(mockUpdate).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          where: { id: "draft-q-1" },
          data: { status: "RENDERING" },
        })
      );
      expect(mockUpdate).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          where: { id: "draft-q-1" },
          data: expect.objectContaining({ status: "COMPLETED" }),
        })
      );
    });

    it("returns null if no QUEUED jobs exist", async () => {
      const mockDb = {
        tikTokVideoDraft: {
          findFirst: vi.fn().mockResolvedValue(null),
        },
      };

      const result = await processNextJob(mockDb as never);
      expect(result).toBeNull();
    });
  });
});
