"use client";

import React, { useState, useEffect, useCallback } from "react";
import { MessageSquare, Send, RefreshCw, CheckCircle2, User, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { ThreadsReplyItem } from "@/lib/threads-replies";

interface InteractionsTabProps {
  brandId: string;
}

interface PostInteractionGroup {
  postId: string;
  postContent: string;
  threadsId: string;
  replies: ThreadsReplyItem[];
}

export function InteractionsTab({ brandId }: InteractionsTabProps) {
  const [postGroups, setPostGroups] = useState<PostInteractionGroup[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [publishingReplyId, setPublishingReplyId] = useState<string | null>(null);

  const fetchInteractions = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/interactions?brandId=${encodeURIComponent(brandId)}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.posts)) {
        setPostGroups(data.posts);
        // Pre-populate editable drafts
        const initialDrafts: Record<string, string> = {};
        for (const group of data.posts) {
          for (const reply of group.replies) {
            if (reply.draftReply) {
              initialDrafts[reply.id] = reply.draftReply;
            }
          }
        }
        setReplyDrafts(initialDrafts);
      } else {
        toast.error(data.error || "댓글을 불러오지 못했습니다.");
      }
    } catch {
      toast.error("댓글 목록 조회 중 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  }, [brandId]);

  useEffect(() => {
    void fetchInteractions();
  }, [fetchInteractions]);

  const handlePublishReply = async (replyToThreadsId: string) => {
    const text = replyDrafts[replyToThreadsId]?.trim();
    if (!text) {
      toast.error("답글 내용을 입력하세요.");
      return;
    }

    setPublishingReplyId(replyToThreadsId);
    try {
      const res = await fetch("/api/interactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brandId,
          replyToThreadsId,
          replyText: text,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "답글 발행 실패");
      }

      toast.success("Threads에 답글이 발행되었습니다!");
      // Mark as published locally
      setPostGroups((prev) =>
        prev.map((group) => ({
          ...group,
          replies: group.replies.filter((r) => r.id !== replyToThreadsId),
        }))
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "답글 발행 실패");
    } finally {
      setPublishingReplyId(null);
    }
  };

  const totalReplies = postGroups.reduce((acc, g) => acc + g.replies.length, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <MessageSquare className="w-5 h-5 text-violet-500" />
            <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">
              독자 댓글 & AI 답글 인게이지먼트
            </h2>
            <span className="text-xs px-2 py-0.5 rounded-full bg-violet-50 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400 font-medium">
              Human-in-the-loop
            </span>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            내 글에 달린 독자의 댓글을 감지하고, 친절한 맞춤형 AI 답글 초안을 원클릭으로 승인 발행합니다.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchInteractions}
          disabled={isLoading}
          className="shrink-0 gap-1.5"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
          새로고침
        </Button>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <RefreshCw className="w-6 h-6 animate-spin text-violet-500" />
        </div>
      ) : totalReplies === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 text-center p-6">
          <CheckCircle2 className="w-10 h-10 text-emerald-500 mb-3 opacity-80" />
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">
            현재 미답변 댓글이 없습니다!
          </h3>
          <p className="text-xs text-slate-400 max-w-sm">
            최근 발행된 포스트에 독자가 새 댓글을 남기면 여기에 자동으로 표시되며, AI 추천 답글을 검토하고 바로 발행할 수 있습니다.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {postGroups.map((group) => {
            if (group.replies.length === 0) return null;
            return (
              <div
                key={group.postId}
                className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm space-y-4"
              >
                {/* Parent Post Context */}
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-400">
                  <span className="font-semibold text-slate-700 dark:text-slate-300 mr-2">📌 원문 포스트:</span>
                  <span className="line-clamp-2">{group.postContent}</span>
                </div>

                {/* Replies List */}
                <div className="space-y-4 pt-2">
                  {group.replies.map((reply) => (
                    <div
                      key={reply.id}
                      className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-850 space-y-3"
                    >
                      {/* Reader Comment */}
                      <div className="flex items-start gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center shrink-0 mt-0.5">
                          <User className="w-4 h-4 text-slate-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                              @{reply.username || "reader"}
                            </span>
                            <span className="text-[11px] text-slate-400">
                              {new Date(reply.timestamp).toLocaleDateString("ko-KR")}
                            </span>
                          </div>
                          <p className="text-sm text-slate-700 dark:text-slate-300 mt-1">
                            {reply.text}
                          </p>
                        </div>
                      </div>

                      {/* AI Draft Response Editor */}
                      <div className="pl-9 space-y-2">
                        <div className="flex items-center gap-1.5 text-xs text-violet-600 dark:text-violet-400 font-medium">
                          <Sparkles className="w-3.5 h-3.5" />
                          AI 추천 답글 초안 (수정 가능):
                        </div>
                        <textarea
                          value={replyDrafts[reply.id] || ""}
                          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                            setReplyDrafts((prev) => ({
                              ...prev,
                              [reply.id]: e.target.value,
                            }))
                          }
                          rows={2}
                          className="w-full p-2.5 rounded-lg text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 resize-none focus:outline-none focus:ring-1 focus:ring-violet-500"
                          placeholder="답글 내용을 입력하세요..."
                        />
                        <div className="flex justify-end">
                          <Button
                            size="sm"
                            onClick={() => handlePublishReply(reply.id)}
                            disabled={publishingReplyId === reply.id}
                            className="bg-violet-600 hover:bg-violet-700 text-white text-xs gap-1.5"
                          >
                            {publishingReplyId === reply.id ? (
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Send className="w-3.5 h-3.5" />
                            )}
                            답글 즉시 발행
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
