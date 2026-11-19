"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export interface TelegramChannelSummary {
  id: string;
  handle: string | null;
  enabled: boolean;
}

/** News desk channel: the bot (env TELEGRAM_BOT_TOKEN) must already be an admin of the channel with "post messages". */
export function TelegramChannelCard({ brandId, account, botReady }: { brandId: string; account: TelegramChannelSummary | null; botReady: boolean }) {
  const router = useRouter();
  const [chat, setChat] = useState(account?.handle?.startsWith("@") ? account.handle : "");
  const [busy, setBusy] = useState(false);

  async function connect() {
    setBusy(true);
    try {
      const res = await fetch("/api/channel-accounts/telegram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brandId, chat }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(data?.error ?? `연결 실패 (${res.status})`);
      toast.success("텔레그램 채널을 연결했습니다");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "연결 실패");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900/40 p-4 space-y-3">
      <div>
        <p className="text-sm font-medium text-white">
          텔레그램 채널 (뉴스 데스크)
          {account?.handle ? <span className="ml-2 text-slate-400">{account.handle}</span> : null}
        </p>
        <p className="text-xs text-slate-400 mt-0.5">
          뉴스 데스크에서 승인한 원고를 이 채널에 올립니다. 먼저 봇을 채널 관리자로 추가하고 &quot;메시지 게시&quot; 권한을 주세요.
        </p>
        {!botReady && <p className="text-xs text-amber-300 mt-1">서버에 TELEGRAM_BOT_TOKEN이 없어 연결할 수 없습니다.</p>}
        {account && !account.enabled && <p className="text-xs text-amber-300 mt-1">일시 중지됨 — 다시 연결하면 켜집니다.</p>}
      </div>
      <div className="flex flex-wrap gap-2">
        <label htmlFor="telegram-chat" className="sr-only">텔레그램 채널 주소</label>
        <input
          id="telegram-chat" value={chat} onChange={(e) => setChat(e.target.value)} placeholder="@채널이름 또는 t.me 링크"
          className="min-w-0 flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500"
        />
        <Button type="button" variant="outline" size="sm" disabled={busy || !botReady || !chat.trim()} onClick={() => void connect()}
          className="border-violet-500/40 bg-transparent text-violet-200 hover:bg-violet-500/10">
          {busy ? <RefreshCw className="mr-1.5 h-4 w-4 animate-spin" /> : <Send className="mr-1.5 h-4 w-4" />}
          {account ? "다시 연결" : "연결"}
        </Button>
      </div>
    </div>
  );
}
