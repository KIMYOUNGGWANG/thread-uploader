import type { UploadPlatform } from "../accounts";
import { instagramAdapter } from "./instagram";
import { telegramAdapter } from "./telegram";
import { threadsAdapter } from "./threads";
import { tiktokAdapter } from "./tiktok";
import type { ChannelAdapter } from "./types";
import { xAdapter } from "./x";
import { youtubeAdapter } from "./youtube";

export const CHANNEL_ADAPTERS: Record<UploadPlatform, ChannelAdapter> = {
  youtube: youtubeAdapter,
  instagram: instagramAdapter,
  tiktok: tiktokAdapter,
  x: xAdapter,
  telegram: telegramAdapter,
  threads: threadsAdapter,
};

export type { ChannelAdapter, StepResult, UploadJob, UploadKind, ChannelMetrics } from "./types";
