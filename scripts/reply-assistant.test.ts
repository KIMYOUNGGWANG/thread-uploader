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

describe("reply-assistant reply voice", async () => {
  process.env.THREADS_ACCESS_TOKEN ??= "test-token";
  process.env.THREADS_USER_ID ??= "test-user";
  const { generateDomainReply } = await import("./reply-assistant.mjs");
  const samples = [
    "가르칠 수준은 아닌 듯", "퇴사할지 버틸지 힘들어요", "나도!", "균시차도 봐야죠", "살아온 거 되짚어보면 맞더라",
    "더 헷갈려요", "네 바뀌었네요", "썸머타임은요?", "만세력 어플에 다 있음", "야자시는요?", "미국에서 태어났어요",
    "23:10", "23:45", "9시 10분", "9시 40분", "아기가 오후 3시 5분", "역술가마다 다르고 오후 1시 5분", "새벽 4시",
    "나 사시생인데", "알고 있었어", "30분 빼도 똑같아", "서울에서 태어난거", "사주 관심 많아요", "좋은 글",
    "감사합니다", "글 잘 봤어요",
  ];
  const replies = samples.map((text, i) => generateDomainReply({ id: `c${i}`, text, username: "u" }, ""));

  it("follows brand-voice.md: 반말, no emoji, no banned words", () => {
    for (const reply of replies) {
      expect(reply).not.toMatch(/(습니다|세요|에요|해요|드릴게요|드려요)/);
      expect(reply).not.toMatch(/\p{Extended_Pictographic}/u);
      expect(reply).not.toMatch(/리스크|32분|진태양시|데이터/);
    }
  });

  it("answers short thanks with thanks, not a question", () => {
    for (const [i, text] of ["감사합니다", "글 잘 봤어요", "좋은 정보 감사해요", "공감합니다"].entries()) {
      const reply = generateDomainReply({ id: `thx${i}`, text });
      expect(reply).toContain("고마워");
      expect(reply).not.toContain("?");
    }
  });

  it("keeps the 30-minute correction math", () => {
    expect(generateDomainReply({ id: "t1", text: "23:10" })).toContain("22시 40분이라 자시 아니고 해시");
    expect(generateDomainReply({ id: "t2", text: "9시 40분" })).toContain("09시 10분이라 사시 아니고 진시");
    expect(generateDomainReply({ id: "t3", text: "새벽 4시" })).toContain("03시 30분, 인시(寅時)(03:30~05:30)");
  });
});
