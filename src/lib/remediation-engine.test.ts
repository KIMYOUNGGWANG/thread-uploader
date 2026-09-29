import { describe, expect, it } from "vitest";
import {
  applyHeuristicFixes,
  remediatePostAlgorithmic,
} from "./remediation-engine";

describe("remediation-engine", () => {
  it("moves body URLs to firstComment and strips meta text via 0-token heuristic patch", () => {
    const rawContent = `이직 타이밍 vs 현 직장 존버\n\n상세 진단은 https://cosmicpath.app 에서 확인해보세요.\n\n자수 체크: 500자 이하 통과`;
    const result = applyHeuristicFixes(rawContent, null);

    expect(result.modified).toBe(true);
    expect(result.content).not.toContain("https://cosmicpath.app");
    expect(result.content).not.toContain("자수 체크");
    expect(result.firstComment).toContain("https://cosmicpath.app");
    expect(result.changes.length).toBeGreaterThanOrEqual(2);
  });

  it("splits continuous paragraphs to improve mobile readability", () => {
    const denseContent = `첫 번째 문장입니다.
두 번째 문장입니다.
세 번째 문장입니다.
네 번째 문장입니다.`;

    const result = applyHeuristicFixes(denseContent, null);
    expect(result.content).toContain("\n\n");
    expect(result.changes).toContain("모바일 피드 가독성을 위한 단락 호흡 자동 분할 (+5~10점)");
  });

  it("returns INITIAL_PASS directly if post already scores >= 80", async () => {
    // High-scoring post: strong hook, choices, spacing, human voice, no links
    const greatPost = `이직 vs 존버 중 진짜 당신에게 맞는 선택은 뭘까요?

1. 물경력 탈출하고 연봉 올린다
2. 현 직장에서 안정성 확보하며 이직 준비한다

둘 중 어느 쪽에 더 마음이 가시나요? 댓글로 남겨주세요.`;

    const result = await remediatePostAlgorithmic(greatPost, "여러분의 생각을 댓글로 공유해주세요.");
    expect(result.pass).toBe(true);
    expect(result.method).toBe("INITIAL_PASS");
    expect(result.scoreResult.totalScore).toBeGreaterThanOrEqual(80);
    expect(result.rewriteCount).toBe(0);
  });

  it("elevates a post with a body link to pass via heuristic patch without LLM rewriting", async () => {
    // Post has great structure but penalized heavily for link in body
    const postWithLink = `이직 vs 존버 중 진짜 당신에게 맞는 선택은 뭘까요?

1. 물경력 탈출하고 연봉 올린다
2. 현 직장에서 안정성 확보하며 이직 준비한다

둘 중 어느 쪽에 더 마음이 가시나요? 댓글로 남겨주세요.
https://mytestlink.com`;

    const result = await remediatePostAlgorithmic(postWithLink, null);
    expect(result.pass).toBe(true);
    expect(result.method).toBe("HEURISTIC_PATCH");
    expect(result.content).not.toContain("https://mytestlink.com");
    expect(result.firstComment).toContain("https://mytestlink.com");
    expect(result.rewriteCount).toBe(0);
  });
});
