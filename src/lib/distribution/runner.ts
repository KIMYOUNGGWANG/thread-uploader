import type { ChannelAccount, ChannelUpload } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sendSystemAlert } from "@/lib/alert-service";
import { isRecord } from "@/types/config-normalizers";
import { getChannelCredentials, type UploadPlatform } from "./accounts";
import { CHANNEL_ADAPTERS, type StepResult, type UploadJob, type UploadKind } from "./adapters";
import { ChannelApiError } from "./http";

export const MAX_ATTEMPTS = 3;
// Longer than the route maxDuration (300s), so a live run never looks interrupted.
const LOCK_MS = 10 * 60 * 1000;
const RETRY_BACKOFF_MS = [10 * 60 * 1000, 30 * 60 * 1000, 2 * 60 * 60 * 1000];
const POLL_ERROR_DELAY_MS = 5 * 60 * 1000;
const PROCESSING_TIMEOUT_MS = 24 * 60 * 60 * 1000;
export const INTERRUPTED_MESSAGE = "업로드 중 중단됨 — 채널에 올라갔는지 확인한 뒤 필요하면 다시 시도하세요";

type UploadRow = ChannelUpload & { channelAccount: ChannelAccount };

export interface RunReport {
  published: number;
  processing: number;
  retrying: number;
  failed: number;
  skipped: number;
}

function parseObject(raw: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(raw);
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function parseUrls(raw: string): string[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((u): u is string => typeof u === "string") : [];
  } catch {
    return [];
  }
}

export function toJob(row: ChannelUpload): UploadJob {
  return {
    id: row.id,
    kind: row.kind as UploadKind,
    caption: row.caption,
    mediaUrls: parseUrls(row.mediaUrls),
    privacy: row.privacy === "private" ? "private" : "public",
    externalId: row.externalId,
    platformData: parseObject(row.platformData),
  };
}

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error)).slice(0, 1000);

async function markFailed(row: UploadRow, message: string): Promise<void> {
  await prisma.channelUpload.update({
    where: { id: row.id },
    data: { status: "FAILED", errorLog: message, lockedUntil: null, nextAttemptAt: null },
  });
  try {
    await sendSystemAlert({ level: "warning", title: `${row.channelAccount.platform} upload failed`, message: `${row.sourceKey}: ${message}` });
  } catch {
    // alerts are best effort
  }
}

async function applyStep(row: UploadRow, step: StepResult, now: Date): Promise<"published" | "processing"> {
  if (step.state === "published") {
    await prisma.channelUpload.update({
      where: { id: row.id },
      data: {
        status: "PUBLISHED",
        externalId: step.externalId,
        externalUrl: step.externalUrl,
        publishedAt: now,
        platformData: JSON.stringify(step.platformData ?? parseObject(row.platformData)),
        errorLog: null,
        lockedUntil: null,
        nextAttemptAt: null,
      },
    });
    return "published";
  }
  await prisma.channelUpload.update({
    where: { id: row.id },
    data: {
      status: "PROCESSING",
      platformData: JSON.stringify({ processingSince: now.toISOString(), ...step.platformData }),
      ...(step.externalId ? { externalId: step.externalId } : {}),
      lockedUntil: null,
      nextAttemptAt: new Date(now.getTime() + (step.retryAfterMs ?? 60_000)),
    },
  });
  return "processing";
}

/** Claims one row for this run; returns false when another run got it first. */
async function claim(row: UploadRow, now: Date): Promise<boolean> {
  const { count } = await prisma.channelUpload.updateMany({
    where: { id: row.id, status: row.status, OR: [{ lockedUntil: null }, { lockedUntil: { lt: now } }] },
    data: {
      lockedUntil: new Date(now.getTime() + LOCK_MS),
      // Mark UPLOADING before calling the platform so a crash mid-upload is never retried blindly.
      ...(row.status === "QUEUED" ? { status: "UPLOADING", attempts: { increment: 1 } } : {}),
    },
  });
  return count === 1;
}

async function startUpload(row: UploadRow, now: Date): Promise<keyof RunReport> {
  const attempts = row.attempts + 1;
  try {
    const adapter = CHANNEL_ADAPTERS[row.channelAccount.platform as UploadPlatform];
    if (!adapter || !adapter.kinds.includes(row.kind as UploadKind)) {
      throw new ChannelApiError(`${row.channelAccount.platform} cannot upload ${row.kind}`, null, true);
    }
    const creds = await getChannelCredentials(row.channelAccount, now);
    return await applyStep(row, await adapter.start(toJob(row), creds), now);
  } catch (error) {
    const permanent = error instanceof ChannelApiError && error.permanent;
    if (permanent || attempts >= MAX_ATTEMPTS) {
      await markFailed(row, `${errorMessage(error)}${permanent ? "" : ` (${attempts}회 시도)`}`);
      return "failed";
    }
    await prisma.channelUpload.update({
      where: { id: row.id },
      data: {
        status: "QUEUED",
        errorLog: errorMessage(error),
        lockedUntil: null,
        platformData: "{}",
        nextAttemptAt: new Date(now.getTime() + RETRY_BACKOFF_MS[Math.min(attempts - 1, RETRY_BACKOFF_MS.length - 1)]),
      },
    });
    return "retrying";
  }
}

async function pollUpload(row: UploadRow, now: Date): Promise<keyof RunReport> {
  const job = toJob(row);
  const since = typeof job.platformData.processingSince === "string" ? Date.parse(job.platformData.processingSince) : NaN;
  if (Number.isFinite(since) && now.getTime() - since > PROCESSING_TIMEOUT_MS) {
    await markFailed(row, "플랫폼 처리가 24시간 넘게 끝나지 않음");
    return "failed";
  }
  try {
    const adapter = CHANNEL_ADAPTERS[row.channelAccount.platform as UploadPlatform];
    if (!adapter?.poll) throw new ChannelApiError(`${row.channelAccount.platform} has no poll step`, null, true);
    const creds = await getChannelCredentials(row.channelAccount, now);
    return await applyStep(row, await adapter.poll(job, creds), now);
  } catch (error) {
    if (error instanceof ChannelApiError && error.retryFromStart && row.attempts < MAX_ATTEMPTS) {
      await prisma.channelUpload.update({
        where: { id: row.id },
        data: { status: "QUEUED", errorLog: errorMessage(error), platformData: "{}", lockedUntil: null, nextAttemptAt: new Date(now.getTime() + RETRY_BACKOFF_MS[0]) },
      });
      return "retrying";
    }
    if ((error instanceof ChannelApiError && (error.permanent || error.retryFromStart))) {
      await markFailed(row, errorMessage(error));
      return "failed";
    }
    // A failed status check says nothing about the upload itself: keep polling (never re-upload).
    await prisma.channelUpload.update({
      where: { id: row.id },
      data: { errorLog: errorMessage(error), lockedUntil: null, nextAttemptAt: new Date(now.getTime() + POLL_ERROR_DELAY_MS) },
    });
    return "processing";
  }
}

export async function runDueUploads(now = new Date(), options: { budgetMs?: number; limit?: number } = {}): Promise<RunReport> {
  const budgetMs = options.budgetMs ?? 200_000;
  const started = Date.now();
  const report: RunReport = { published: 0, processing: 0, retrying: 0, failed: 0, skipped: 0 };

  // An UPLOADING row whose lock ran out was interrupted mid-call. The platform may already have it,
  // so fail it for a human to check instead of uploading a duplicate.
  const interrupted = await prisma.channelUpload.findMany({
    where: { status: "UPLOADING", lockedUntil: { lt: now } },
    include: { channelAccount: true },
  });
  for (const row of interrupted) {
    await markFailed(row, INTERRUPTED_MESSAGE);
    report.failed += 1;
  }

  const due = await prisma.channelUpload.findMany({
    where: {
      status: { in: ["QUEUED", "PROCESSING"] },
      scheduledAt: { lte: now },
      channelAccount: { enabled: true },
      AND: [
        { OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }] },
        { OR: [{ lockedUntil: null }, { lockedUntil: { lt: now } }] },
      ],
    },
    include: { channelAccount: true },
    orderBy: { scheduledAt: "asc" },
    take: options.limit ?? 25,
  });

  for (const row of due) {
    if (Date.now() - started > budgetMs) break;
    if (!(await claim(row, now))) {
      report.skipped += 1;
      continue;
    }
    const outcome = row.status === "PROCESSING" ? await pollUpload(row, now) : await startUpload(row, now);
    report[outcome] += 1;
  }
  return report;
}
