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
