import { prisma } from "@/lib/prisma";

export type DraftAction = "cancel" | "resume" | "publish_now";
export type UploadAction = "cancel" | "retry" | "ack_public";

export const isDraftAction = (v: unknown): v is DraftAction => v === "cancel" || v === "resume" || v === "publish_now";
export const isUploadAction = (v: unknown): v is UploadAction => v === "cancel" || v === "retry" || v === "ack_public";

export type ControlResult = { ok: true } | { ok: false; status: number; error: string };

const fail = (status: number, error: string): ControlResult => ({ ok: false, status, error });

/** Cancel window controls for a finished video. Only uploads that have not started can be stopped. */
export async function applyDraftAction(draftId: string, action: DraftAction, now = new Date()): Promise<ControlResult> {
  const draft = await prisma.videoDraft.findUnique({
    where: { id: draftId },
    select: { status: true, canceledAt: true, autoPublishAt: true, uploads: { select: { status: true } } },
  });
  if (!draft) return fail(404, "영상을 찾을 수 없습니다");
  if (draft.status !== "COMPLETED") return fail(409, "완성된 영상만 조정할 수 있습니다");
  const started = draft.uploads.some((u) => u.status !== "QUEUED" && u.status !== "CANCELED");

  if (action === "cancel") {
    if (started) return fail(409, "이미 업로드가 시작된 채널이 있어 취소할 수 없습니다");
    await prisma.$transaction([
      prisma.videoDraft.update({ where: { id: draftId }, data: { canceledAt: now } }),
      prisma.channelUpload.updateMany({ where: { videoDraftId: draftId, status: "QUEUED" }, data: { status: "CANCELED" } }),
    ]);
    return { ok: true };
  }

  if (action === "resume") {
    if (!draft.canceledAt) return { ok: true };
    await prisma.$transaction([
      // A window that already closed reopens at "now": the next upload run picks it up.
      prisma.videoDraft.update({
        where: { id: draftId },
        data: { canceledAt: null, autoPublishAt: draft.autoPublishAt && draft.autoPublishAt > now ? draft.autoPublishAt : now },
      }),
      prisma.channelUpload.updateMany({
        where: { videoDraftId: draftId, status: "CANCELED" },
        data: { status: "QUEUED", scheduledAt: now, nextAttemptAt: null },
      }),
    ]);
    return { ok: true };
  }

  if (draft.canceledAt) return fail(409, "취소된 영상입니다. 먼저 취소를 되돌리세요");
  await prisma.videoDraft.update({ where: { id: draftId }, data: { autoPublishAt: now } });
  return { ok: true };
}

export async function applyUploadAction(uploadId: string, action: UploadAction, now = new Date()): Promise<ControlResult> {
  const upload = await prisma.channelUpload.findUnique({ where: { id: uploadId }, select: { status: true, platformData: true } });
  if (!upload) return fail(404, "업로드를 찾을 수 없습니다");

  if (action === "cancel") {
    const { count } = await prisma.channelUpload.updateMany({ where: { id: uploadId, status: "QUEUED" }, data: { status: "CANCELED" } });
    return count === 1 ? { ok: true } : fail(409, "대기 중인 업로드만 취소할 수 있습니다");
  }

  if (action === "retry") {
    const { count } = await prisma.channelUpload.updateMany({
      where: { id: uploadId, status: { in: ["FAILED", "CANCELED"] } },
      data: {
        status: "QUEUED", attempts: 0, errorLog: null, platformData: "{}", externalId: null,
        scheduledAt: now, nextAttemptAt: null, lockedUntil: null,
      },
    });
    return count === 1 ? { ok: true } : fail(409, "실패했거나 취소된 업로드만 다시 시도할 수 있습니다");
  }

  if (upload.status !== "PUBLISHED") return fail(409, "올라간 영상만 표시할 수 있습니다");
  let data: Record<string, unknown> = {};
  try {
    const parsed: unknown = JSON.parse(upload.platformData);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) data = parsed as Record<string, unknown>;
  } catch {
    // keep empty
  }
  await prisma.channelUpload.update({
    where: { id: uploadId },
    data: { platformData: JSON.stringify({ ...data, madePublicAt: now.toISOString() }) },
  });
  return { ok: true };
}
