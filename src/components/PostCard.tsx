"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Clock, ImageIcon, AlertCircle, Check, Pencil, Trash2, Copy, CheckCircle2, Upload, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ParsedPost, validatePost } from "@/lib/parser";
import { toast } from "sonner";

interface PostCardProps {
    post: ParsedPost;
    index: number;
    isPosted?: boolean;
    dbPostId?: string;
    status?: string;
    threadsId?: string | null;
    errorLog?: string | null;
    onUpdate: (index: number, post: ParsedPost) => void;
    onDelete: (index: number) => void;
    onTogglePosted?: (index: number) => void;
    onRefresh?: () => void;
}

export function PostCard({
    post,
    index,
    isPosted = false,
    dbPostId,
    errorLog,
    onUpdate,
    onDelete,
    onTogglePosted,
    onRefresh
}: PostCardProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [editedContent, setEditedContent] = useState(post.content);
    const [editedComment, setEditedComment] = useState(post.firstComment || "");
    const [editedDate, setEditedDate] = useState(
        post.scheduledAt ? format(post.scheduledAt, "yyyy-MM-dd'T'HH:mm") : ""
    );
    const [copied, setCopied] = useState(false);
    const [isUploading, setIsUploading] = useState(false);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(post.content);
            setCopied(true);
            toast.success("복사됨! Threads에 붙여넣기 하세요");
            setTimeout(() => setCopied(false), 2000);
        } catch {
            toast.error("복사 실패");
        }
    };

    const handleUpload = async () => {
        if (isUploading) return;

        if (!dbPostId) {
            toast.error("저장되지 않은 포스트입니다");
            return;
        }

        setIsUploading(true);
        try {
            const response = await fetch(`/api/posts/${dbPostId}/publish`, {
                method: "POST",
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "Upload failed");
            }

            if (data.replyError) {
                toast.warning(data.message || "본문은 업로드됐지만 첫 댓글은 실패했습니다.");
            } else {
                toast.success("🎉 Threads에 업로드 완료!");
            }

            // Refresh the posts list
            if (onRefresh) {
                onRefresh();
            } else if (onTogglePosted && !isPosted) {
                onTogglePosted(index);
            }
        } catch (error) {
            console.error("Upload error:", error);
            toast.error(error instanceof Error ? error.message : "업로드 실패");

            // Refresh to show FAILED status
            if (onRefresh) {
                onRefresh();
            }
        } finally {
            setIsUploading(false);
        }
    };

    const validation = validatePost(post);
    const charCount = post.content.length;
    const isOverLimit = charCount > 500;

    const handleSave = () => {
        onUpdate(index, {
            ...post,
            content: editedContent,
            firstComment: editedComment || undefined,
            scheduledAt: editedDate ? new Date(editedDate) : null,
        });
        setIsEditing(false);
    };

    const handleCancel = () => {
        setEditedContent(post.content);
        setEditedComment(post.firstComment || "");
        setEditedDate(post.scheduledAt ? format(post.scheduledAt, "yyyy-MM-dd'T'HH:mm") : "");
        setIsEditing(false);
    };

    return (
        <Card
            className={cn(
                "relative overflow-hidden transition-all duration-300",
                "hover:shadow-lg hover:shadow-violet-500/10",
                "border-slate-200 dark:border-slate-700",
                !validation.valid && "border-red-300 dark:border-red-800",
                isPosted && "opacity-60 bg-green-50 dark:bg-green-950/20 border-green-300 dark:border-green-800"
            )}
        >
            {/* Index Badge */}
            <div className="absolute top-3 left-3 w-8 h-8 flex items-center justify-center bg-gradient-to-br from-violet-500 to-purple-600 text-white text-sm font-bold rounded-full shadow-md">
                {index + 1}
            </div>

            {/* Delete Button */}
            <Button
                variant="ghost"
                size="icon"
                className="absolute top-2 right-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950"
                onClick={() => onDelete(index)}
            >
                <Trash2 className="w-4 h-4" />
            </Button>

            <CardContent className="pt-12 pb-4">
                {/* Content */}
                {isEditing ? (
                    <div className="space-y-4">
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">본문 내용</label>
                            <textarea
                                value={editedContent}
                                onChange={(e) => setEditedContent(e.target.value)}
                                className="w-full h-32 p-3 text-sm border rounded-lg resize-none focus:ring-2 focus:ring-violet-500 focus:border-transparent dark:bg-slate-800 dark:border-slate-600"
                                placeholder="본문 내용을 입력하세요..."
                            />
                        </div>
                        
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">💬 첫 댓글 (댓글 게시용)</label>
                            <textarea
                                value={editedComment}
                                onChange={(e) => setEditedComment(e.target.value)}
                                className="w-full h-20 p-3 text-sm border rounded-lg resize-none focus:ring-2 focus:ring-violet-500 focus:border-transparent dark:bg-slate-800 dark:border-slate-600 border-dashed"
                                placeholder="첫 번째 댓글 내용을 입력하세요..."
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">예약 일시</label>
                            <Input
                                type="datetime-local"
                                value={editedDate}
                                onChange={(e) => setEditedDate(e.target.value)}
                                className="w-full"
                            />
                        </div>
                        <div className="flex gap-2 justify-end">
                            <Button variant="outline" size="sm" onClick={handleCancel}>
                                Cancel
                            </Button>
                            <Button size="sm" onClick={handleSave}>
                                Save
                            </Button>
                        </div>
                    </div>
                ) : (
                    <>
                        <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap line-clamp-6">
                            {post.content}
                        </p>

                        {/* First Comment Preview */}
                        {post.firstComment && (
                            <div className="mt-3 p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-100 dark:border-slate-800 border-dashed">
                                <div className="flex items-center gap-1.5 mb-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                    <Clock className="w-3 h-3" />
                                    첫 댓글 예약됨
                                </div>
                                <p className="text-xs text-slate-500 dark:text-slate-400 italic line-clamp-2">
                                    &quot;{post.firstComment}&quot;
                                </p>
                            </div>
                        )}

                        {/* Metadata */}
                        <div className="mt-4 flex flex-wrap gap-3">
                            {/* Order indicator - no time display, just status */}
                            <div className={cn(
                                "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium",
                                isPosted 
                                    ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
                                    : status === "FAILED"
                                        ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300"
                                        : "bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300"
                            )}>
                                #{index + 1} {isPosted ? "업로드 완료" : status === "FAILED" ? "업로드 실패" : "대기중"}
                            </div>

                            {/* Images */}
                            {post.images.length > 0 && (
                                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-xs font-medium">
                                    <ImageIcon className="w-3.5 h-3.5" />
                                    {post.images.length} image{post.images.length > 1 ? "s" : ""}
                                </div>
                            )}

                            {/* Character count */}
                            <div
                                className={cn(
                                    "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium",
                                    isOverLimit
                                        ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300"
                                        : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                                )}
                            >
                                {charCount}/500
                            </div>
                        </div>

                        {/* Validation errors */}
                        {!validation.valid && (
                            <div className="mt-3 p-2 bg-red-50 dark:bg-red-950/30 rounded-lg">
                                {validation.errors.map((error, i) => (
                                    <div
                                        key={i}
                                        className="flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400"
                                    >
                                        <AlertCircle className="w-3.5 h-3.5" />
                                        {error}
                                    </div>
                                ))}
                            </div>
                        )}

                        {errorLog && (
                            <div className="mt-3 p-2 bg-amber-50 dark:bg-amber-950/30 rounded-lg">
                                <div className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-300">
                                    <AlertCircle className="w-3.5 h-3.5" />
                                    {errorLog}
                                </div>
                            </div>
                        )}

                        {/* Action buttons */}
                        <div className="mt-3 flex flex-wrap gap-2">
                            {/* Upload Button - Primary Action */}
                            <Button
                                variant="default"
                                size="sm"
                                className={cn(
                                    "bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white",
                                    isPosted && "from-green-500 to-green-600"
                                )}
                                onClick={handleUpload}
                                disabled={isUploading || !validation.valid || isPosted}
                            >
                                {isUploading ? (
                                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                                ) : isPosted ? (
                                    <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                                ) : (
                                    <Upload className="w-3.5 h-3.5 mr-1.5" />
                                )}
                                {isUploading ? "업로드 중..." : isPosted ? "업로드됨" : "Threads 업로드"}
                            </Button>

                            {/* Copy Button */}
                            <Button
                                variant="outline"
                                size="sm"
                                className={cn(
                                    copied && "border-green-500 text-green-500"
                                )}
                                onClick={handleCopy}
                            >
                                {copied ? (
                                    <Check className="w-3.5 h-3.5 mr-1.5" />
                                ) : (
                                    <Copy className="w-3.5 h-3.5 mr-1.5" />
                                )}
                                {copied ? "복사됨!" : "복사"}
                            </Button>

                            {/* Edit Button */}
                            <Button
                                variant="ghost"
                                size="sm"
                                className="text-slate-500 hover:text-violet-600"
                                onClick={() => setIsEditing(true)}
                            >
                                <Pencil className="w-3.5 h-3.5 mr-1.5" />
                                수정
                            </Button>
                        </div>
                    </>
                )}
            </CardContent>

            {/* Status indicator */}
            {validation.valid && (
                <div className="absolute bottom-3 right-3 w-6 h-6 flex items-center justify-center bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-full">
                    <Check className="w-4 h-4" />
                </div>
            )}
        </Card>
    );
}
