import { afterEach, describe, expect, it, vi } from "vitest";
import {
  generatePostsInChunks,
  readJsonObjectResponse,
} from "@/lib/generate-client";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("readJsonObjectResponse", () => {
  it("returns a safe error object when the response body is not JSON", async () => {
    const response = new Response("An error occurred while generating the response.", {
      status: 500,
      headers: { "content-type": "text/plain" },
    });

    const data = await readJsonObjectResponse<{ readonly count?: number }>(
      response,
      "생성 실패"
    );

    expect(data.error).toBe("An error occurred while generating the response.");
  });
});

describe("generatePostsInChunks", () => {
  it("throws a readable message when the API error field is an object", async () => {
    const fetchMock = vi.fn(async () => (
      new Response(JSON.stringify({ error: { message: "Claude quota exceeded" } }), {
        status: 500,
        headers: { "content-type": "application/json" },
      })
    ));
    vi.stubGlobal("fetch", fetchMock);

    await expect(generatePostsInChunks({
      brandId: "brand_1",
      count: 1,
      fallbackMessage: "생성 실패",
    })).rejects.toThrow("Claude quota exceeded");
  });

  it("splits large generation requests into smaller API calls", async () => {
    const fetchMock = vi.fn(async () => (
      new Response(JSON.stringify({ count: 7, linkedCount: 1, campaignId: "campaign_1" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    ));
    vi.stubGlobal("fetch", fetchMock);

    const result = await generatePostsInChunks({
      brandId: "brand_1",
      count: 21,
      approvedCampaignStart: true,
      fallbackMessage: "생성 실패",
    });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(result).toEqual({
      count: 21,
      linkedCount: 3,
      campaignId: "campaign_1",
    });
  });
});
