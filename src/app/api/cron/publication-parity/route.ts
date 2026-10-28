import { NextRequest, NextResponse } from "next/server";
import { verifyCronSecret } from "@/lib/cron-auth";
import { prisma } from "@/lib/prisma";
import { comparePublication } from "@/lib/channels/parity";
import {
  INSTAGRAM_SELECT,
  THREADS_SELECT,
  instagramPublicationFromPost,
  threadsPublicationFromPost,
  type ChannelPlatform,
} from "@/lib/channels/publication-mirror";

export const maxDuration = 300;

const WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

// ponytail: one-off rollout check; delete in the legacy-column cleanup phase
/** Read-only: compares Post-derived mirrors with stored Publications for posts published in the last 30 days. */
export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const posts = await prisma.post.findMany({
      where: { publishedAt: { gte: new Date(Date.now() - WINDOW_MS) } },
      select: {
        ...THREADS_SELECT,
        ...INSTAGRAM_SELECT,
        publications: { select: { status: true, externalId: true, views: true, channelAccount: { select: { platform: true } } } },
      },
    });

    let checked = 0;
    const mismatches: { postId: string; platform: ChannelPlatform; diffs: string[] }[] = [];
    for (const post of posts) {
      const expectedBy: Record<ChannelPlatform, ReturnType<typeof threadsPublicationFromPost>> = {
        threads: threadsPublicationFromPost(post),
        instagram: instagramPublicationFromPost(post),
      };
      for (const platform of ["threads", "instagram"] as const) {
        const actual = post.publications.find((p) => p.channelAccount.platform === platform) ?? null;
        const diffs = comparePublication(expectedBy[platform], actual);
        checked++;
        if (diffs.length > 0) mismatches.push({ postId: post.id, platform, diffs });
      }
    }
    return NextResponse.json({ checked, mismatches });
  } catch (error: unknown) {
    console.error("[publication-parity]", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
