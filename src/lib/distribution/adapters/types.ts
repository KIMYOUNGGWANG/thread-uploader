import type { ChannelCredentials } from "../accounts";

export type UploadKind = "video" | "carousel" | "text";

export interface UploadJob {
  id: string;
  kind: UploadKind;
  caption: string;
  mediaUrls: string[];
  privacy: "public" | "private";
  externalId: string | null;
  platformData: Record<string, unknown>;
}

export type StepResult =
  | { state: "published"; externalId: string; externalUrl: string | null; platformData?: Record<string, unknown> }
  /** Accepted by the platform but not live yet; the runner polls again after `retryAfterMs`. */
  | { state: "processing"; platformData: Record<string, unknown>; externalId?: string; retryAfterMs?: number };

export interface ChannelMetrics {
  externalId: string;
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  /** Instagram only (insights `saved` / `reach`); other channels leave them out. */
  saves?: number | null;
  reach?: number | null;
}

export interface ChannelAdapter {
  kinds: readonly UploadKind[];
  start(job: UploadJob, creds: ChannelCredentials): Promise<StepResult>;
  poll?(job: UploadJob, creds: ChannelCredentials): Promise<StepResult>;
  metrics?(externalIds: string[], creds: ChannelCredentials): Promise<ChannelMetrics[]>;
}
