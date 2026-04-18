import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";
import { checkQuality } from "@/lib/quality-gate";
import { parseBrandConfig } from "@/types/brand";
import type { BrandFormula, BrandConfig } from "@/types/brand";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const SEPARATOR = "===FIRST_COMMENT===";
const RETRYABLE_STATUSES = new Set([429, 529]);

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function shuffleTopics(topics: string[], count: number): string[] {
  const shuffled = [...topics].sort(() => Math.random() - 0.5);
  const result: string[] = [];
  while (result.length < count) {
    result.push(...shuffled.slice(0, Math.min(topics.length, count - result.length)));
  }
  return result;
}

function buildFormulaPool(
  formulas: BrandFormula[],
  dbWeights: Record<string, number>
): BrandFormula[] {
  const pool: BrandFormula[] = [];
  for (const formula of formulas) {
    const weight = dbWeights[formula.id] ?? formula.weight;
    for (let i = 0; i < weight; i++) pool.push(formula);
  }
  return pool;
}

async function generateOne(
  formula: BrandFormula,
  topic: string,
  config: BrandConfig,
  retries = 5,
  delayMs = 3000
): Promise<{ post: string; firstComment: string }> {
  const target = pickRandom(config.targets.length ? config.targets : ["일반 독자"]);
  const situation = pickRandom(config.situations.length ? config.situations : ["일상적인 상황"]);

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const message = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 900,
        temperature: 0.95,
        system: config.systemPrompt,
        messages: [
          {
            role: "user",
            content: `[공식: ${formula.name}]\n${formula.instruction}\n\n[주제]\n${topic}\n\n[타겟 독자]\n${target}\n\n[상황/맥락]\n${situation}\n\n위 공식, 주제, 타겟, 상황을 조합해서 Threads 포스트 1개를 작성해줘.\n작성 후 ${SEPARATOR} 를 출력하고, 바로 아래에 첫 댓글을 작성해줘.`,
          },
        ],
      });

      const raw = (message.content[0] as { text: string }).text.trim();
      const parts = raw.split(SEPARATOR);
      return { post: parts[0].trim(), firstComment: (parts[1] ?? "").trim() };
    } catch (err: unknown) {
      const status = typeof err === "object" && err !== null ? (err as { status?: number }).status : undefined;
      if (status !== undefined && RETRYABLE_STATUSES.has(status) && attempt < retries) {
        console.warn(`API ${status} (attempt ${attempt}/${retries}). Retrying in ${delayMs * attempt}ms…`);
        await new Promise((res) => setTimeout(res, delayMs * attempt));
      } else {
        throw err;
      }
    }
  }
  throw new Error("generateOne: exceeded max retries");
}

async function generateWithQuality(
  formula: BrandFormula,
  topic: string,
  config: BrandConfig,
  maxRetries = 2
): Promise<{ post: string; firstComment: string; formulaId: string; qualityScore: number }> {
  let lastResult = await generateOne(formula, topic, config);
  let qualityResult = checkQuality(lastResult.post);

  for (let attempt = 1; attempt <= maxRetries && !qualityResult.pass; attempt++) {
    console.warn(`Quality FAIL (score ${qualityResult.score}/3, attempt ${attempt}/${maxRetries}):`, qualityResult.reasons);
    lastResult = await generateOne(formula, topic, config);
    qualityResult = checkQuality(lastResult.post);
  }

  if (!qualityResult.pass) {
    console.warn(`Quality WARNING: 최대 재시도 초과. score=${qualityResult.score}/3. 그대로 저장.`);
  }

  const utmLink = `${config.websiteUrl}?utm_source=threads&utm_medium=social&utm_campaign=${formula.id}`;
  const firstCommentWithUtm = lastResult.firstComment
    ? `${lastResult.firstComment}\n\n→ ${utmLink}`
    : `→ ${utmLink}`;

  return {
    post: lastResult.post,
    firstComment: firstCommentWithUtm,
    formulaId: formula.id,
    qualityScore: qualityResult.score,
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { brandId?: unknown; count?: unknown; insertAtFront?: unknown };
    const brandId = typeof body.brandId === "string" ? body.brandId : null;
    const count = typeof body.count === "number" ? body.count : 30;
    const insertAtFront = body.insertAtFront === true;

    if (!brandId) {
      return NextResponse.json({ error: "brandId is required" }, { status: 400 });
    }
    if (count < 1 || count > 300) {
      return NextResponse.json({ error: "count는 1~300 사이여야 합니다" }, { status: 400 });
    }

    const brand = await prisma.brand.findUnique({ where: { id: brandId } });
    if (!brand) {
      return NextResponse.json({ error: "Brand not found" }, { status: 404 });
    }

    const config = parseBrandConfig(brand.brandConfig);
    if (!config.formulas.length) {
      return NextResponse.json({ error: "브랜드에 공식이 설정되지 않았습니다. 브랜드 설정에서 formulas를 추가하세요." }, { status: 400 });
    }
    if (!config.topics.length) {
      return NextResponse.json({ error: "브랜드에 주제가 설정되지 않았습니다. 브랜드 설정에서 topics를 추가하세요." }, { status: 400 });
    }
    if (!config.systemPrompt) {
      return NextResponse.json({ error: "브랜드에 시스템 프롬프트가 설정되지 않았습니다." }, { status: 400 });
    }

    const dbWeights = JSON.parse(brand.formulaWeights) as Record<string, number>;
    const formulaPool = buildFormulaPool(config.formulas, dbWeights);
    const topics = shuffleTopics(config.topics, count);

    const BATCH = 3;
    const BATCH_COOLDOWN = 500;
    const results: { post: string; firstComment: string; formulaId: string; qualityScore: number }[] = [];

    for (let i = 0; i < count; i += BATCH) {
      const batch = Array.from({ length: Math.min(BATCH, count - i) }, (_, j) => {
        const formula = pickRandom(formulaPool);
        const topic = topics[i + j];
        return generateWithQuality(formula, topic, config);
      });
      results.push(...await Promise.all(batch));
      if (i + BATCH < count) {
        await new Promise((res) => setTimeout(res, BATCH_COOLDOWN));
      }
    }

    let baseTime = Date.now();
    if (insertAtFront) {
      const earliest = await prisma.post.findFirst({
        where: { status: "PENDING", brandId },
        orderBy: { scheduledAt: "asc" },
      });
      if (earliest) baseTime = earliest.scheduledAt.getTime() - count * 1000;
    } else {
      const latest = await prisma.post.findFirst({
        where: { status: "PENDING", brandId },
        orderBy: { scheduledAt: "desc" },
      });
      if (latest && latest.scheduledAt.getTime() > Date.now()) {
        baseTime = latest.scheduledAt.getTime() + 1000;
      }
    }

    await prisma.post.createMany({
      data: results.map(({ post, firstComment, formulaId }, i) => ({
        brandId,
        content: post,
        firstComment: firstComment || null,
        imageUrls: "[]",
        scheduledAt: new Date(baseTime + i * 1000),
        status: "PENDING",
        formulaId,
      })),
    });

    return NextResponse.json({ success: true, count: results.length });
  } catch (error) {
    console.error("Generate error:", error);
    return NextResponse.json({ error: "생성 실패" }, { status: 500 });
  }
}
