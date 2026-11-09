"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Key, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { DistributionConfig, VideoChannel } from "@/lib/distribution/config";

export interface ChannelAccountSummary {
  id: string;
  platform: "youtube" | "tiktok" | "x";
  handle: string | null;
  enabled: boolean;
  connected: boolean;
}

export interface ChannelDistributionData {
  accounts: ChannelAccountSummary[];
  instagramConnected: boolean;
  distribution: DistributionConfig;
  configured: Record<"youtube" | "tiktok" | "x", boolean>;
}

const PLATFORMS: { id: "youtube" | "tiktok" | "x"; label: string; note: string }[] = [
  { id: "youtube", label: "YouTube 쇼츠", note: "완성 영상을 공개로 올립니다." },
  { id: "tiktok", label: "TikTok", note: "앱 심사 전에는 비공개로만 올라갑니다. 공개 전환은 아침 보고판의 할 일로 뜹니다." },
  { id: "x", label: "X", note: "Threads에 발행된 글을 280자에 맞춰 교차 게시합니다." },
];

const VIDEO_LABEL: Record<VideoChannel, string> = { youtube: "YouTube", instagram: "Instagram 릴스", tiktok: "TikTok" };
const OUTLINE = "border-slate-600 bg-transparent text-slate-200 hover:bg-slate-800 hover:text-white";
const INPUT = "w-24 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500";

async function send(url: string, method: string, body?: unknown): Promise<void> {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(data?.error ?? `요청 실패 (${res.status})`);
  }
}

export function ChannelDistributionSection({ brandId, data }: { brandId: string; data: ChannelDistributionData }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [config, setConfig] = useState<DistributionConfig>(data.distribution);

  const run = async (key: string, task: () => Promise<void>, success: string) => {
    setBusy(key);
    try {
      await task();
      toast.success(success);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "실패했습니다");
    } finally {
      setBusy(null);
    }
  };

  const toggleVideoChannel = (channel: VideoChannel) => {
    setConfig((c) => ({
      ...c,
      video: { channels: c.video.channels.includes(channel) ? c.video.channels.filter((v) => v !== channel) : [...c.video.channels, channel] },
    }));
  };

  return (
    <div className="bg-slate-800/40 border border-slate-700 rounded-2xl p-5 space-y-5">
      <div>
        <h2 className="text-base font-semibold text-white">영상·카드뉴스·X 배포</h2>
        <p className="text-xs text-slate-400 mt-0.5">
          완성된 영상과 카드뉴스는 취소 창이 지나면 자동으로 올라갑니다. 취소는 아침 보고판과 영상 공장 화면에서 할 수 있어요.
        </p>
      </div>

      <div className="space-y-3">
        {PLATFORMS.map((p) => {
          const account = data.accounts.find((a) => a.platform === p.id);
          const connected = Boolean(account?.connected);
          return (
            <div key={p.id} className="rounded-xl border border-slate-700 bg-slate-900/40 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-white">
                    {p.label}
                    {connected && account?.handle ? <span className="ml-2 text-slate-400">{account.handle}</span> : null}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">{p.note}</p>
                  {!data.configured[p.id] && (
                    <p className="text-xs text-amber-300 mt-1">서버에 앱 키가 없어 연결할 수 없습니다 (README의 환경 변수 참고).</p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {connected && account && (
                    <Button
                      type="button" variant="outline" size="sm" disabled={busy !== null}
                      onClick={() => run(`toggle-${p.id}`, () => send(`/api/channel-accounts/${account.id}`, "PATCH", { enabled: !account.enabled }), account.enabled ? "일시 중지했습니다" : "다시 켰습니다")}
                      className={OUTLINE}
                    >
                      {account.enabled ? "일시 중지" : "다시 켜기"}
                    </Button>
                  )}
                  {connected && account && (
                    <Button
                      type="button" variant="outline" size="sm" disabled={busy !== null}
                      onClick={() => run(`disconnect-${p.id}`, () => send(`/api/channel-accounts/${account.id}`, "DELETE"), "연결을 해제했습니다")}
                      className="border-red-500/40 bg-transparent text-red-300 hover:bg-red-900/20 hover:text-red-200"
                    >
                      연결 해제
                    </Button>
                  )}
                  <Button
                    type="button" variant="outline" size="sm" disabled={busy !== null || !data.configured[p.id]}
                    onClick={() => {
                      setBusy(`connect-${p.id}`);
                      window.location.assign(`/api/oauth/${p.id}/start?brandId=${encodeURIComponent(brandId)}`);
                    }}
                    className="border-violet-500/40 bg-transparent text-violet-200 hover:bg-violet-500/10"
                  >
                    {busy === `connect-${p.id}` ? <RefreshCw className="mr-1.5 h-4 w-4 animate-spin" /> : <Key className="mr-1.5 h-4 w-4" />}
                    {connected ? "다시 연결" : "연결"}
                  </Button>
                </div>
              </div>
              {connected && account && !account.enabled && <p className="text-xs text-amber-300 mt-2">일시 중지됨 — 이 채널로는 올리지 않습니다.</p>}
            </div>
          );
        })}
      </div>

      <div className="space-y-4 border-t border-slate-700 pt-4">
        <label className="flex items-center gap-3 text-sm text-slate-300">
          취소 창
          <input
            type="number" min={0} max={48} value={config.cancelWindowHours}
            onChange={(e) => setConfig((c) => ({ ...c, cancelWindowHours: Math.max(0, Math.min(48, Number(e.target.value) || 0)) }))}
            className={INPUT}
          />
          시간
        </label>

        <div className="space-y-1.5">
          <p className="text-sm text-slate-300">영상 올릴 채널</p>
          <div className="flex flex-wrap gap-4">
            {(Object.keys(VIDEO_LABEL) as VideoChannel[]).map((channel) => (
              <label key={channel} className="flex items-center gap-2 text-sm text-slate-300">
                <input type="checkbox" checked={config.video.channels.includes(channel)} onChange={() => toggleVideoChannel(channel)} />
                {VIDEO_LABEL[channel]}
              </label>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-sm text-slate-300">
          <label className="flex items-center gap-2">
            <input
              type="checkbox" checked={config.cardNews.enabled}
              onChange={(e) => setConfig((c) => ({ ...c, cardNews: { ...c.cardNews, enabled: e.target.checked } }))}
            />
            카드뉴스(인스타 캐러셀)
          </label>
          <label className="flex items-center gap-2">
            하루
            <input
              type="number" min={1} max={5} value={config.cardNews.dailyCap}
              onChange={(e) => setConfig((c) => ({ ...c, cardNews: { ...c.cardNews, dailyCap: Math.max(1, Math.min(5, Number(e.target.value) || 1)) } }))}
              className={INPUT}
            />
            개
          </label>
          {!data.instagramConnected && <span className="text-xs text-amber-300">Instagram을 먼저 연결해야 올라갑니다</span>}
        </div>

        <div className="flex flex-wrap items-center gap-4 text-sm text-slate-300">
          <label className="flex items-center gap-2">
            <input
              type="checkbox" checked={config.x.enabled}
              onChange={(e) => setConfig((c) => ({ ...c, x: { ...c.x, enabled: e.target.checked } }))}
            />
            X 교차 게시
          </label>
          <label className="flex items-center gap-2">
            하루
            <input
              type="number" min={1} max={15} value={config.x.dailyCap}
              onChange={(e) => setConfig((c) => ({ ...c, x: { ...c.x, dailyCap: Math.max(1, Math.min(15, Number(e.target.value) || 1)) } }))}
              className={INPUT}
            />
            개
          </label>
        </div>

        <Button
          type="button" disabled={busy !== null}
          onClick={() => run("save", () => send(`/api/brands/${brandId}/distribution`, "PUT", config), "배포 설정을 저장했습니다")}
          className="bg-violet-600 hover:bg-violet-700 text-white"
        >
          배포 설정 저장
        </Button>
      </div>
    </div>
  );
}
