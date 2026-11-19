import { isRecord } from "@/types/config-normalizers";
import { REQUEST_TIMEOUT_MS } from "./http";

export class TelegramConnectError extends Error {}

/** Accepts "@name", "name", "https://t.me/name" or a numeric chat id like "-1001234567890". */
export function normalizeChatInput(raw: string): string | null {
  const value = raw.trim();
  if (/^-?\d{5,}$/.test(value)) return value;
  const name = value.replace(/^(https?:\/\/)?(www\.)?t\.me\//i, "").replace(/^@/, "").split(/[/?#]/)[0];
  return /^[A-Za-z][A-Za-z0-9_]{3,31}$/.test(name) ? `@${name}` : null;
}

// Read-only calls (getMe/getChat/getChatMember): safe to fail loudly. Messages never include the token.
async function call(token: string, method: string, params: Record<string, string | number>): Promise<Record<string, unknown>> {
  let data: unknown;
  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(params),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    data = await response.json().catch(() => null);
  } catch {
    throw new TelegramConnectError("텔레그램에 연결하지 못했어. 잠시 뒤 다시 해줘");
  }
  if (isRecord(data) && data.ok === true && isRecord(data.result)) return data.result;
  const description = isRecord(data) && typeof data.description === "string" ? data.description : "알 수 없는 오류";
  if (/chat not found/i.test(description)) throw new TelegramConnectError("채널을 찾을 수 없어. 봇을 채널 관리자로 먼저 추가해줘");
  if (/unauthorized/i.test(description)) throw new TelegramConnectError("봇 토큰이 맞지 않아 (TELEGRAM_BOT_TOKEN 확인)");
  throw new TelegramConnectError(`텔레그램 확인 실패: ${description.slice(0, 200)}`);
}

export interface TelegramChannel {
  chatId: string;
  handle: string;
}

/** Confirms the chat is a channel where this bot is an admin allowed to post. */
export async function verifyTelegramChannel(rawChat: string, token: string): Promise<TelegramChannel> {
  const chat = normalizeChatInput(rawChat);
  if (!chat) throw new TelegramConnectError("채널 주소를 @이름 또는 t.me 링크로 넣어줘");
  const me = await call(token, "getMe", {});
  const info = await call(token, "getChat", { chat_id: chat });
  if (info.type !== "channel") throw new TelegramConnectError("채널만 연결할 수 있어 (그룹은 아직 안 돼)");
  const member = await call(token, "getChatMember", { chat_id: chat, user_id: Number(me.id) });
  const canPost = member.status === "creator" || (member.status === "administrator" && member.can_post_messages === true);
  if (!canPost) throw new TelegramConnectError("봇에게 채널 '메시지 게시' 관리자 권한을 줘");
  const username = typeof info.username === "string" ? info.username : null;
  const title = typeof info.title === "string" ? info.title : chat;
  return { chatId: username ? `@${username}` : String(info.id), handle: username ? `@${username}` : title };
}
