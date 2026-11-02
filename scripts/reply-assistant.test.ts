// scripts/reply-assistant.test.ts — CLI guard: an empty --post-id must not fall back to scanning every recent post.
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";

const scriptPath = fileURLToPath(new URL("./reply-assistant.mjs", import.meta.url));

describe("reply-assistant --post-id", () => {
  it("exits before any Threads fetch when --post-id is empty", () => {
    const result = spawnSync(process.execPath, [scriptPath, "--interactive", "--post-id="], {
      encoding: "utf8",
      env: { ...process.env, THREADS_ACCESS_TOKEN: "test-token", THREADS_USER_ID: "test-user" },
      timeout: 10_000,
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("--post-id");
    expect(result.stdout).not.toContain("Fetching recent posts");
  });
});

describe("reply-assistant reply safety", async () => {
  process.env.THREADS_ACCESS_TOKEN ??= "test-token";
  process.env.THREADS_USER_ID ??= "test-user";
  const { selectPendingComments, publishGapMs, needsManualDm } = await import("./reply-assistant.mjs");
  const POST = "post-1";

  it("keeps only unanswered top-level comments from people we have not talked to under this post", () => {
    const comments = [
      { id: "a", username: "alice", replied_to: { id: POST } },
      { id: "b", username: "bob", replied_to: { id: POST } },
      { id: "b-ours", username: "cosmicpath.app", is_reply_owned_by_me: true, replied_to: { id: "b" } },
      { id: "b2", username: "bob", replied_to: { id: POST } },
      { id: "nested", username: "carol", replied_to: { id: "b-ours" } },
      { id: "cached", username: "dave", replied_to: { id: POST } },
      { id: "e", username: "erin", replied_to: POST },
    ];
    const pending = selectPendingComments(POST, comments, new Set(["cached"]));
    expect(pending.map((c: { id: string }) => c.id)).toEqual(["a", "e"]);
  });

  it("spaces publishes 30-45 seconds apart", () => {
    expect(publishGapMs(() => 0)).toBe(30_000);
    expect(publishGapMs(() => 0.999)).toBeLessThan(45_000);
  });

  it("flags DM replies so they are never auto-posted", () => {
    expect(needsManualDm("DM으로 진단 링크 보낼게. 생년월일이랑 태어난 시간 넣으면 바로 나와")).toBe(true);
    expect(needsManualDm("네! 9시 10분에서 30분 빼면 진시예요")).toBe(false);
  });
});
