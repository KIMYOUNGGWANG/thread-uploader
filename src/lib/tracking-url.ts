/**
 * Tracking URL Builder & Parser for Threads Closed-Loop Attribution
 */

export interface TrackingParams {
  postId?: string;
  formulaId?: string;
  track?: "track_a" | "track_b" | "track_c" | string;
  campaignId?: string;
  source?: string;
}

export function buildTrackedUrl(baseUrl: string, params: TrackingParams): string {
  try {
    const url = new URL(baseUrl);
    url.searchParams.set("ref", params.source ?? "threads");
    url.searchParams.set("utm_source", "threads");
    url.searchParams.set("utm_medium", "social");
    url.searchParams.set("utm_campaign", "threads_growth");

    if (params.postId) url.searchParams.set("pid", params.postId);
    if (params.formulaId) url.searchParams.set("fid", params.formulaId);
    if (params.track) url.searchParams.set("track", params.track);
    if (params.campaignId) url.searchParams.set("cid", params.campaignId);

    return url.toString();
  } catch {
    // If baseUrl is relative or invalid, format query string manually
    const searchParams = new URLSearchParams();
    searchParams.set("ref", params.source ?? "threads");
    if (params.postId) searchParams.set("pid", params.postId);
    if (params.formulaId) searchParams.set("fid", params.formulaId);
    if (params.track) searchParams.set("track", params.track);

    const separator = baseUrl.includes("?") ? "&" : "?";
    return `${baseUrl}${separator}${searchParams.toString()}`;
  }
}

export function parseTrackingParams(urlOrQuery: string): TrackingParams {
  try {
    const urlString = urlOrQuery.startsWith("http") ? urlOrQuery : `https://dummy.local/${urlOrQuery.startsWith("?") ? urlOrQuery : `?${urlOrQuery}`}`;
    const url = new URL(urlString);
    const params = url.searchParams;

    return {
      postId: params.get("pid") ?? undefined,
      formulaId: params.get("fid") ?? undefined,
      track: params.get("track") ?? undefined,
      campaignId: params.get("cid") ?? undefined,
      source: params.get("ref") ?? params.get("utm_source") ?? undefined,
    };
  } catch {
    return {};
  }
}
