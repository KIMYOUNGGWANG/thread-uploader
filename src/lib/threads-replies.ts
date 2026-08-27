/**
 * Threads Replies & Engagement Service (autoTHREADS benchmark)
 * Fetches replies to published posts and generates engaging AI draft responses.
 */

import Anthropic from "@anthropic-ai/sdk";

export interface ThreadsReplyItem {
  id: string;
  text: string;
  username: string;
  timestamp: string;
  draftReply?: string;
}

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  timeout: 6000,
});

/**
 * Fetches replies for a given Threads media post from Graph API.
 */
export async function fetchRepliesForPost(
  threadsMediaId: string,
  accessToken: string
): Promise<ThreadsReplyItem[]> {
  try {
    const url = `https://graph.threads.net/v1.0/${threadsMediaId}/conversation?fields=id,text,timestamp,username&access_token=${encodeURIComponent(accessToken)}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);

    if (!res.ok) {
      // If conversation endpoint fails, try /replies endpoint
      const fallbackUrl = `https://graph.threads.net/v1.0/${threadsMediaId}/replies?fields=id,text,timestamp,username&access_token=${encodeURIComponent(accessToken)}`;
      const fallbackRes = await fetch(fallbackUrl);
      if (!fallbackRes.ok) return [];
      const fallbackData = await fallbackRes.json();
      return Array.isArray(fallbackData.data) ? fallbackData.data : [];
    }

    const data = await res.json();
    return Array.isArray(data.data) ? data.data : [];
  } catch (error) {
    console.warn(`[Threads Replies] fetchRepliesForPost error for ${threadsMediaId}:`, error);
    return [];
  }
}

/**
 * Generates an engaging AI draft reply to a user's comment.
 */
export async function generateDraftReply(
  parentPostText: string,
  commentText: string,
  brandTone = "전문적이면서 친근하고 솔직한 어조"
): Promise<string> {
  const fallback = "댓글 남겨주셔서 감사합니다! 말씀해주신 부분도 정말 공감되네요. 다음 포스트에서 더 깊게 풀어보겠습니다.";

  if (!process.env.ANTHROPIC_API_KEY) {
    return fallback;
  }

  try {
    const prompt = [
      `[원문 포스트]`,
      parentPostText.slice(0, 300),
      "",
      `[독자 댓글]`,
      commentText,
      "",
      `[답글 작성 지침]`,
      `1. 톤앤매너: ${brandTone}`,
      "2. 분량: 1~2문장 (100자 이내의 짧고 자연스러운 한국어 구어체)",
      "3. 느낌표(!)를 남발하지 않고 따뜻하면서도 센스 있는 대화형 어조",
      "4. 독자의 의견을 인정하고 감사를 표하거나 자연스러운 되물음 유도",
      "5. 광고나 링크 홍보 절대 금지",
      "",
      "오직 답글 텍스트만 출력하세요:",
    ].join("\n");

    const message = await client.messages.create({
      model: "claude-3-5-haiku-latest",
      max_tokens: 150,
      temperature: 0.7,
      messages: [{ role: "user", content: prompt }],
    });

    const block = message.content[0];
    if (block && block.type === "text") {
      return block.text.trim().replace(/^["']|["']$/g, "");
    }
    return fallback;
  } catch (err) {
    console.warn("[Threads Replies] Claude draft generation failed, using fallback:", err);
    return fallback;
  }
}
