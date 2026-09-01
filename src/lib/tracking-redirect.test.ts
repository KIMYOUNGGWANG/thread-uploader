import { describe, expect, it, vi } from "vitest";
import { buildShortRedirectUrl, buildTrackedUrl, parseTrackingParams } from "./tracking-url";

describe("Short Redirect and Tracking Attribution", () => {
  it("builds short redirect url cleanly without double slashes", () => {
    const shortUrl1 = buildShortRedirectUrl("https://thread-uploader.vercel.app", "post_abc123");
    const shortUrl2 = buildShortRedirectUrl("https://thread-uploader.vercel.app/", "post_abc123");

    expect(shortUrl1).toBe("https://thread-uploader.vercel.app/r/post_abc123");
    expect(shortUrl2).toBe("https://thread-uploader.vercel.app/r/post_abc123");
  });

  it("builds tracked URL preserving all critical attribution params", () => {
    const tracked = buildTrackedUrl("https://myproduct.com/start", {
      postId: "post_789",
      formulaId: "contrarian",
      campaignId: "camp_456",
      track: "track_b",
    });

    expect(tracked).toContain("https://myproduct.com/start?");
    expect(tracked).toContain("ref=threads");
    expect(tracked).toContain("utm_source=threads");
    expect(tracked).toContain("utm_medium=social");
    expect(tracked).toContain("utm_campaign=threads_growth");
    expect(tracked).toContain("pid=post_789");
    expect(tracked).toContain("fid=contrarian");
    expect(tracked).toContain("cid=camp_456");
    expect(tracked).toContain("track=track_b");

    const parsed = parseTrackingParams(tracked);
    expect(parsed.postId).toBe("post_789");
    expect(parsed.formulaId).toBe("contrarian");
    expect(parsed.campaignId).toBe("camp_456");
    expect(parsed.track).toBe("track_b");
  });

  it("handles /r/[code] redirect route correctly with click tracking", async () => {
    const { GET } = await import("@/app/r/[code]/route");
    const { prisma } = await import("@/lib/prisma");
    const { NextRequest } = await import("next/server");

    const mockPost = {
      id: "post_test123",
      formulaId: "contrarian",
      campaignId: "camp_abc",
      linkUrl: "https://www.cosmicpath.app/start?utm_source=threads&pid=post_test123",
      brand: {
        brandConfig: JSON.stringify({
          websiteUrl: "https://www.cosmicpath.app",
        }),
      },
    };

    const findSpy = vi.spyOn(prisma.post, "findUnique").mockResolvedValue(mockPost as unknown as Awaited<ReturnType<typeof prisma.post.findUnique>>);
    const updateSpy = vi.spyOn(prisma.post, "update").mockResolvedValue(mockPost as unknown as Awaited<ReturnType<typeof prisma.post.update>>);

    const request = new NextRequest("https://localhost:3000/r/post_test123");
    const response = await GET(request, { params: Promise.resolve({ code: "post_test123" }) });

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("https://www.cosmicpath.app/start");
    expect(response.headers.get("location")).toContain("pid=post_test123");
    expect(updateSpy).toHaveBeenCalledWith({
      where: { id: "post_test123" },
      data: { clicks: { increment: 1 } },
    });

    findSpy.mockRestore();
    updateSpy.mockRestore();
  });
});

