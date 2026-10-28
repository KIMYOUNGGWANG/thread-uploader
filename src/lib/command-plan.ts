import Anthropic from "@anthropic-ai/sdk";
import { CLAUDE_TEXT_MODEL, readMessageText } from "@/lib/claude-text";
import { isRecord } from "@/types/config-normalizers";

/** One command makes at most one refill-sized batch. */
export const MAX_COMMAND_COUNT = 6; // ponytail: same cap as MAX_REFILL_PER_RUN; raise together
const DEFAULT_COMMAND_COUNT = 3;
const MAX_HYPOTHESIS_LENGTH = 500;

export interface CommandBrand {
  id: string;
  slug: string;
  name: string;
}

export interface CommandPlan {
  brandId: string;
  count: number;
  /** Empty keeps the brand's current experiment hypothesis. */
  hypothesis: string;
}

/** Validates a plan the client sends back for approval. Null when it is not one of the caller's brands or out of range. */
export function parseCommandPlan(input: unknown, brands: CommandBrand[]): CommandPlan | null {
  if (!isRecord(input)) return null;
  const { brandId, count, hypothesis } = input;
  if (typeof brandId !== "string" || !brands.some((brand) => brand.id === brandId)) return null;
  if (typeof count !== "number" || !Number.isInteger(count) || count < 1 || count > MAX_COMMAND_COUNT) return null;
  if (hypothesis !== undefined && typeof hypothesis !== "string") return null;
  return { brandId, count, hypothesis: (hypothesis ?? "").trim().slice(0, MAX_HYPOTHESIS_LENGTH) };
}

/** Turns a one-line command into a plan. Claude when the key is set, a keyword parser otherwise. */
export async function interpretCommand(text: string, brands: CommandBrand[]): Promise<CommandPlan> {
  const command = text.trim();
  if (!command) throw new Error("명령이 비어 있습니다");
  if (brands.length === 0) throw new Error("브랜드가 없습니다");
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return interpretCommandLocally(command, brands);

  const client = new Anthropic({ apiKey, timeout: 30_000, maxRetries: 1 });
  const message = await client.messages.create({
    model: CLAUDE_TEXT_MODEL,
    max_tokens: 500,
    output_config: { format: { type: "json_schema", schema: PLAN_SCHEMA } },
    messages: [{ role: "user", content: buildPrompt(command, brands) }],
  });
  const raw: unknown = JSON.parse(readMessageText(message));
  if (!isRecord(raw)) throw new Error("계획 응답을 읽을 수 없습니다");
  const brand = brands.find((candidate) => candidate.slug === raw.brandSlug);
  if (!brand) throw new Error(`브랜드를 찾을 수 없습니다: ${String(raw.brandSlug)}`);
  const plan = parseCommandPlan({ brandId: brand.id, count: raw.count, hypothesis: raw.hypothesis }, brands);
  if (!plan) throw new Error("계획이 허용 범위를 벗어났습니다");
  return plan;
}

/** Deterministic fallback: brand by slug/name mention, count by "N개", the whole command as the hypothesis. */
export function interpretCommandLocally(text: string, brands: CommandBrand[]): CommandPlan {
  const lower = text.toLowerCase();
  const brand = brands.find((candidate) => lower.includes(candidate.slug.toLowerCase()) || lower.includes(candidate.name.toLowerCase()));
  if (!brand) throw new Error("명령에서 브랜드를 찾을 수 없습니다");
  const countMatch = /(\d+)\s*(?:개|posts?|drafts?)/i.exec(text);
  const count = countMatch ? Math.min(MAX_COMMAND_COUNT, Math.max(1, Number(countMatch[1]))) : DEFAULT_COMMAND_COUNT;
  return { brandId: brand.id, count, hypothesis: text.trim().slice(0, MAX_HYPOTHESIS_LENGTH) };
}

const PLAN_SCHEMA = {
  type: "object",
  properties: {
    brandSlug: { type: "string" },
    count: { type: "integer" },
    hypothesis: { type: "string" },
  },
  required: ["brandSlug", "count", "hypothesis"],
  additionalProperties: false,
};

function buildPrompt(command: string, brands: CommandBrand[]): string {
  const roster = brands.map((brand) => `- ${brand.slug} (${brand.name})`).join("\n");
  return [
    "You turn one operator command into a content plan for a Threads growth system.",
    "Brands (pick exactly one slug):",
    roster,
    "",
    `Command: ${command}`,
    "",
    "Rules:",
    `- count: how many drafts to make, 1-${MAX_COMMAND_COUNT}. Default ${DEFAULT_COMMAND_COUNT} when unspecified.`,
    "- hypothesis: one sentence in the command's language stating what topic or angle the drafts should test. Empty string when the command names no topic.",
  ].join("\n");
}
