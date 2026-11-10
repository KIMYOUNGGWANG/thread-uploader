import { prisma } from "@/lib/prisma";
import { isRecord } from "@/types/config-normalizers";
import { getChannelCredentials, type UploadPlatform } from "./accounts";
import { CHANNEL_ADAPTERS } from "./adapters";

const DAY_MS = 24 * 60 * 60 * 1000;
const WINDOW_MS = 14 * DAY_MS;
const REFRESH_MS = 6 * 60 * 60 * 1000;

export interface MetricsReport {
  accounts: number;
  updated: number;
  errors: string[];
}

/** TikTok private posts carry the publish id, not a video id; they have no readable stats. */
function readableId(platform: string, externalId: string | null, platformData: string): string | null {
  if (!externalId) return null;
  if (platform !== "tiktok") return externalId;
  try {
    const data: unknown = JSON.parse(platformData);
    return isRecord(data) && typeof data.publicPostId === "string" ? data.publicPostId : null;
  } catch {
    return null;
  }
}

export async function collectChannelMetrics(now = new Date()): Promise<MetricsReport> {
  const uploads = await prisma.channelUpload.findMany({
    where: {
      status: "PUBLISHED",
      publishedAt: { gte: new Date(now.getTime() - WINDOW_MS) },
      OR: [{ metricsAt: null }, { metricsAt: { lt: new Date(now.getTime() - REFRESH_MS) } }],
    },
    include: { channelAccount: true },
    take: 300,
  });

  const byAccount = new Map<string, typeof uploads>();
  for (const upload of uploads) {
    const list = byAccount.get(upload.channelAccountId) ?? [];
    list.push(upload);
    byAccount.set(upload.channelAccountId, list);
  }

  const report: MetricsReport = { accounts: byAccount.size, updated: 0, errors: [] };
  for (const rows of byAccount.values()) {
    const account = rows[0].channelAccount;
    const adapter = CHANNEL_ADAPTERS[account.platform as UploadPlatform];
    if (!adapter?.metrics) continue;
    const idToRow = new Map<string, (typeof rows)[number]>();
    for (const row of rows) {
      const id = readableId(account.platform, row.externalId, row.platformData);
      if (id) idToRow.set(id, row);
    }
    if (idToRow.size === 0) continue;
    try {
      const creds = await getChannelCredentials(account, now);
      const metrics = await adapter.metrics([...idToRow.keys()], creds);
      for (const m of metrics) {
        const row = idToRow.get(m.externalId);
        if (!row) continue;
        await prisma.channelUpload.update({
          where: { id: row.id },
          data: { views: m.views, likes: m.likes, comments: m.comments, shares: m.shares, metricsAt: now },
        });
        report.updated += 1;
      }
    } catch (error) {
      report.errors.push(`${account.platform}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return report;
}
