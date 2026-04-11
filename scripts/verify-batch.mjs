/**
 * verify-batch.mjs
 * Threads 포스트 품질 검증기 (Expert Panel)
 */

import Anthropic from "@anthropic-ai/sdk";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

// ── env 로드 ──────────────────────────────────────────────────────────────
const envPath = path.join(root, ".env.local");
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, "utf-8");
  content.split("\n").forEach(line => {
    const [key, ...value] = line.split("=");
    if (key && value.length) process.env[key.trim()] = value.join("=").trim().replace(/^["']|["']$/g, "");
  });
}

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const EXPERT_PANEL_REF = path.resolve(root, ".agent/skills/threads-engine/references/expert-panel.md");
const expertPanelGuide = fs.readFileSync(EXPERT_PANEL_REF, "utf-8");

async function verifyPost(postContent, firstComment) {
  const prompt = `
너는 바이럴 콘텐츠 품질을 심사하는 'Expert Panel'이야.
다음 Threads 포스트와 첫 댓글을 아래 기준에 따라 엄격하게 채점해줘.

【심사 기준 가이드】
${expertPanelGuide}

【심사 대상】
본문:
${postContent}

첫 댓글:
${firstComment}

【출력 형식 - 반드시 준수】
Roy Lee: (25점 만점 기준 4개 항목 합산 점수)/100
타깃 유저: (25점 만점 기준 4개 항목 합산 점수)/100
편집장: (25점 만점 기준 4개 항목 합산 점수)/100
평균: (평균 점수)
비평: (어떤 점이 부족하고 어떻게 고쳐야 할지 1문장으로 요약)
합격여부: (90점 이상이면 PASS, 미달이면 FAIL)
`;

  const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 500,
    messages: [{ role: "user", content: prompt }],
  });

  const response = message.content[0].text;
  const scoreMatch = response.match(/평균:\s*(\d+)/);
  const passMatch = response.match(/합격여부:\s*(PASS|FAIL)/);
  
  return {
    raw: response,
    score: scoreMatch ? parseInt(scoreMatch[1], 10) : 0,
    passed: passMatch ? passMatch[1] === "PASS" : false
  };
}

// TODO: 파싱 및 배치 처리 로직 추가 예정
console.log("✅ Expert Panel Script Loaded (Ready for integration)");
