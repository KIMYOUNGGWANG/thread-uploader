export interface RawUserComment {
  id: string;
  text: string;
  likes?: number;
  repliesCount?: number;
}

export interface MinedObjectionHook {
  parentPostId: string;
  commentId?: string;
  rawUserComment: string;
  objectionCore: string;
  nextHeadlineHook: string;
  followUpAngle: string;
  confidenceScore: number;
}

const GENERIC_PRAISE_PATTERNS = [
  /^(?:감사|고맙|잘\s*봤|응원|좋은\s*글|공감|동의|최고|대박)/,
  /^(?:수고|화이팅|인정|맞아요|맞는\s*말)/,
];

const OBJECTION_TRIGGER_PATTERNS = [
  /(?:근데|하지만|그러나|오히려|반대|의문|왜|어떻게|질문|진짜인가요|아닌가요|궁금|맞나요)/,
  /\?/,
];

export function isValuableObjectionComment(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 8) return false;
  if (/^[\p{Emoji}\s]+$/u.test(trimmed)) return false;
  if (GENERIC_PRAISE_PATTERNS.some((p) => p.test(trimmed)) && !trimmed.includes("근데") && !trimmed.includes("?")) {
    return false;
  }

  return OBJECTION_TRIGGER_PATTERNS.some((p) => p.test(trimmed));
}

export function extractObjectionsFromComments(
  comments: RawUserComment[],
  maxCount: number = 5
): RawUserComment[] {
  const filtered = comments.filter((c) => isValuableObjectionComment(c.text));

  filtered.sort((a, b) => {
    const scoreA = (a.likes || 0) * 2 + (a.repliesCount || 0) * 3 + a.text.length * 0.1;
    const scoreB = (b.likes || 0) * 2 + (b.repliesCount || 0) * 3 + b.text.length * 0.1;
    return scoreB - scoreA;
  });

  return filtered.slice(0, maxCount);
}

export async function generateNextHooksFromObjections(
  parentPostId: string,
  objections: RawUserComment[],
  queryFn: (prompt: string) => Promise<string>
): Promise<MinedObjectionHook[]> {
  const hooks: MinedObjectionHook[] = [];

  for (const obj of objections) {
    const prompt = `
[임무: 유저 반론 댓글을 차기 바이럴 훅으로 승격]
유저의 실제 댓글: "${obj.text}"

이 유저 댓글은 대중이 가장 많이 공감한 반론이나 의문점입니다.
이를 바탕으로 다음 포스트의 첫 문장이 될 "반론 기반 해결 훅(Headline Hook)"을 도출하라.

[출력 JSON 규격]
\`\`\`json
{
  "objectionCore": "유저가 지적한 반론의 핵심 요약 (15자 내외)",
  "nextHeadlineHook": "지난 글에 ~라는 질문이 쏟아져서 팩트만 짚는 도발적 훅 (35자 내외)",
  "followUpAngle": "이 반론을 완벽히 납득시킬 통찰 솔루션 1가지"
}
\`\`\`
`.trim();

    try {
      const response = await queryFn(prompt);
      const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || response.match(/(\{[\s\S]*\})/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[1]);
        hooks.push({
          parentPostId,
          commentId: obj.id,
          rawUserComment: obj.text,
          objectionCore: String(parsed.objectionCore || "유저 반론"),
          nextHeadlineHook: String(parsed.nextHeadlineHook || `지난 글 댓글에 ${obj.text.slice(0, 20)}... 질문 많아서 짚어봄`),
          followUpAngle: String(parsed.followUpAngle || "현실적 대안 솔루션"),
          confidenceScore: Math.min(95, 70 + (obj.likes || 0)),
        });
      }
    } catch (err) {
      console.error(`[generateNextHooksFromObjections] Error for comment ${obj.id}:`, err);
    }
  }

  return hooks;
}
