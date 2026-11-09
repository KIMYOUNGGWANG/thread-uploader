import { afterEach, describe, expect, it, vi } from "vitest";
import { buildYouTubeMetadata, youtubeAdapter } from "./youtube";
import { pickTikTokPrivacy, tiktokAdapter } from "./tiktok";
import { xAdapter } from "./x";
import { instagramAdapter } from "./instagram";
import type { UploadJob } from "./types";

const creds = { accessToken: "tok", externalUserId: "u1", handle: "brand" };
const job = (over: Partial<UploadJob> = {}): UploadJob => ({
  id: "up1", kind: "video", caption: "첫 줄 #사주\n둘째 줄", mediaUrls: ["https://blob.example/v.mp4"],
  privacy: "public", externalId: null, platformData: {}, ...over,
});
const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" }, ...init });
const video = () => new Response(new Uint8Array([1, 2, 3, 4]), { status: 200 });

afterEach(() => vi.unstubAllGlobals());

describe("YouTube", () => {
  it("builds a Shorts title from the first line without hashtags", () => {
    const meta = buildYouTubeMetadata("이직 고민이면 #사주\n자세히");
    expect(meta.title).toBe("이직 고민이면 #Shorts");
    expect(meta.tags).toEqual(["사주"]);
    expect(buildYouTubeMetadata("가".repeat(200)).title.length).toBeLessThanOrEqual(100);
  });

  it("uploads through a resumable session", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(video())
      .mockResolvedValueOnce(new Response(null, { status: 200, headers: { Location: "https://upload.example/session" } }))
      .mockResolvedValueOnce(json({ id: "yt123" }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await youtubeAdapter.start(job(), creds);
    expect(result).toEqual({ state: "published", externalId: "yt123", externalUrl: "https://www.youtube.com/shorts/yt123" });
    const init = fetchMock.mock.calls[1][1] as RequestInit;
    expect(JSON.parse(init.body as string).status.privacyStatus).toBe("public");
    expect(fetchMock.mock.calls[2][0]).toBe("https://upload.example/session");
  });

  it("marks quota/permission errors as permanent", async () => {
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(video())
      .mockResolvedValueOnce(json({ error: { message: "quotaExceeded" } }, { status: 403 })));
    await expect(youtubeAdapter.start(job(), creds)).rejects.toMatchObject({ permanent: true });
  });
});

describe("TikTok", () => {
  it("keeps posts private unless public is both wanted and allowed", () => {
    expect(pickTikTokPrivacy(["SELF_ONLY"], true)).toBe("SELF_ONLY");
    expect(pickTikTokPrivacy(["PUBLIC_TO_EVERYONE", "SELF_ONLY"], false)).toBe("SELF_ONLY");
    expect(pickTikTokPrivacy(["PUBLIC_TO_EVERYONE", "SELF_ONLY"], true)).toBe("PUBLIC_TO_EVERYONE");
  });

  it("uploads one chunk and polls until the publish completes", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(json({ data: { privacy_level_options: ["SELF_ONLY"] }, error: { code: "ok" } }))
      .mockResolvedValueOnce(video())
      .mockResolvedValueOnce(json({ data: { publish_id: "p1", upload_url: "https://up.tiktok/x" }, error: { code: "ok" } }))
      .mockResolvedValueOnce(new Response(null, { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);
    const started = await tiktokAdapter.start(job({ privacy: "private" }), creds);
    expect(started).toMatchObject({ state: "processing", platformData: { publishId: "p1", privacyLevel: "SELF_ONLY" } });
    expect((fetchMock.mock.calls[3][1] as RequestInit).headers).toMatchObject({ "Content-Range": "bytes 0-3/4" });

    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(json({ data: { status: "PROCESSING_UPLOAD" }, error: { code: "ok" } })));
    const polling = await tiktokAdapter.poll!(job({ platformData: { publishId: "p1" } }), creds);
    expect(polling.state).toBe("processing");

    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(json({ data: { status: "PUBLISH_COMPLETE" }, error: { code: "ok" } })));
    const done = await tiktokAdapter.poll!(job({ platformData: { publishId: "p1" } }), creds);
    expect(done).toMatchObject({ state: "published", externalId: "p1", externalUrl: null });
  });

  it("fails permanently when TikTok reports FAILED", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(json({ data: { status: "FAILED", fail_reason: "duration" }, error: { code: "ok" } })));
    await expect(tiktokAdapter.poll!(job({ platformData: { publishId: "p1" } }), creds)).rejects.toMatchObject({ permanent: true });
  });
});

describe("X", () => {
  it("posts text and links the status", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(json({ data: { id: "99" } })));
    const result = await xAdapter.start(job({ kind: "text", caption: "안녕", mediaUrls: [] }), creds);
    expect(result).toEqual({ state: "published", externalId: "99", externalUrl: "https://x.com/brand/status/99" });
  });

  it("refuses text over the limit without calling X", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(xAdapter.start(job({ kind: "text", caption: "가".repeat(141) }), creds)).rejects.toMatchObject({ permanent: true });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("Instagram", () => {
  it("creates carousel children then a carousel container", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(json({ id: "c1" }))
      .mockResolvedValueOnce(json({ id: "c2" }))
      .mockResolvedValueOnce(json({ id: "car" }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await instagramAdapter.start(job({ kind: "carousel", mediaUrls: ["https://a/1.jpg", "https://a/2.jpg"] }), creds);
    expect(result).toMatchObject({ state: "processing", platformData: { containerId: "car", childIds: ["c1", "c2"] } });
    const body = fetchMock.mock.calls[2][1].body as URLSearchParams;
    expect(body.get("media_type")).toBe("CAROUSEL");
    expect(body.get("children")).toBe("c1,c2");
  });

  it("needs at least two carousel images", async () => {
    await expect(instagramAdapter.start(job({ kind: "carousel", mediaUrls: ["https://a/1.jpg"] }), creds)).rejects.toMatchObject({ permanent: true });
  });

  it("publishes a finished container and restarts a dead one", async () => {
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(json({ status_code: "FINISHED" }))
      .mockResolvedValueOnce(json({ id: "media1" }))
      .mockResolvedValueOnce(json({ permalink: "https://instagram.com/p/x" })));
    const done = await instagramAdapter.poll!(job({ platformData: { containerId: "k1" } }), creds);
    expect(done).toMatchObject({ state: "published", externalId: "media1", externalUrl: "https://instagram.com/p/x" });

    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(json({ status_code: "ERROR" })));
    await expect(instagramAdapter.poll!(job({ platformData: { containerId: "k1" } }), creds)).rejects.toMatchObject({ retryFromStart: true });
  });
});
