import { describe, expect, it } from "vitest";
import { hasGeneratedMeta } from "./generated-meta-patterns";
import { checkQuality } from "./quality-gate";

const LEAK = "자기분류 셀프체크형 포스트입니다. 실제 투자/이직 결정 타이밍을 앞둔 독자가 혼자 본문 안에서 자신의 상태를";
const CLEAN = "사주에 진술축미 깔려있어?\n돈 창고가 열리는 대운 기준을 저장해.";
const CONTEXT = { viralIntentModeId: "identity_profile" } as const;

describe("hasGeneratedMeta", () => {
  it.each([LEAK, "본문 (482자)", "# Threads Post: 재회", "자수 체크 완료", "===FIRST_COMMENT==="])("flags %s", (text) => {
    expect(hasGeneratedMeta(text)).toBe(true);
  });
  it("passes a normal post", () => {
    expect(hasGeneratedMeta("점집 가서 10만원 복채 내고\n들은 말이 이거였음")).toBe(false);
  });
  it("is enforced by the generation gate, not only at publish", () => {
    // Without the leak line the same post passes, so the failure below is caused by the leak alone.
    expect(checkQuality(CLEAN, "saju_viral", CONTEXT).pass).toBe(true);
    const result = checkQuality(`${CLEAN}\n${LEAK}`, "saju_viral", CONTEXT);
    expect(result.pass).toBe(false);
    expect(result.reasons).toContain("generated meta text 포함");
  });
});
