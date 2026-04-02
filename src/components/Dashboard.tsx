"use client";

import { useState, useCallback, useEffect } from "react";
import { Upload, Sparkles, RotateCcw, CheckCircle2, AlertCircle, RefreshCw, Calendar, Pencil, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FileDropzone } from "@/components/FileDropzone";
import { PostCard } from "@/components/PostCard";
import { parseExcelFile, parseMarkdownFile, ParsedPost, validatePost } from "@/lib/parser";
import { Toaster, toast } from "sonner";

interface DBPost {
    id: string;
    content: string;
    imageUrls: string[];
    scheduledAt: string;
    status: string;
    threadsId: string | null;
    createdAt: string;
    errorLog: string | null;
}

export function Dashboard() {
    const [posts, setPosts] = useState<DBPost[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isFetching, setIsFetching] = useState(true);
    const [showPublished, setShowPublished] = useState(false);
    const [insertAtFront, setInsertAtFront] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [generateCount, setGenerateCount] = useState(30);

    // Fetch posts from DB on mount
    useEffect(() => {
        fetchPosts();
    }, []);

    const fetchPosts = async () => {
        setIsFetching(true);
        try {
            const response = await fetch("/api/posts");
            const data = await response.json();
            if (data.posts) {
                setPosts(data.posts);
            }
        } catch (error) {
            console.error("Error fetching posts:", error);
            toast.error("포스트 불러오기 실패");
        } finally {
            setIsFetching(false);
        }
    };

    const handleGenerate = useCallback(async () => {
        if (!confirm(`AI로 ${generateCount}개 포스트를 생성할까요? (약 1-2분 소요)`)) return;
        setIsGenerating(true);
        try {
            const response = await fetch("/api/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ count: generateCount, insertAtFront }),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || "생성 실패");
            toast.success(`${data.count}개 포스트 생성 완료! 🎉`);
            await fetchPosts();
        } catch (error) {
            console.error("Generate error:", error);
            toast.error(error instanceof Error ? error.message : "AI 생성 실패");
        } finally {
            setIsGenerating(false);
        }
    }, [generateCount, insertAtFront]);

    const handleCreatePost = useCallback(async () => {
        try {
            const newPost = {
                content: "",
                images: [],
                scheduledAt: null
            };

            const response = await fetch("/api/posts", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ posts: [newPost] }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "Failed to create post");
            }

            toast.success("새 글 작성 칸이 생성되었습니다");
            await fetchPosts();
        } catch (error) {
            console.error("Create post error:", error);
            toast.error("글 작성 생성 실패");
        }
    }, []);

    const handleFileSelect = useCallback(async (file: File) => {
        setIsLoading(true);
        try {
            let parsedPosts: ParsedPost[] = [];

            if (file.name.endsWith(".xlsx")) {
                const buffer = await file.arrayBuffer();
                parsedPosts = parseExcelFile(buffer);
            } else if (file.name.endsWith(".md")) {
                const text = await file.text();
                parsedPosts = parseMarkdownFile(text);
            }

            if (parsedPosts.length === 0) {
                toast.error("No posts found in file");
                return;
            }

            // Validate posts
            const validPosts = parsedPosts.filter(p => validatePost(p).valid);
            if (validPosts.length === 0) {
                toast.error("유효한 포스트가 없습니다");
                return;
            }

            // Save to DB
            const response = await fetch("/api/posts", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ posts: validPosts, insertAtFront }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "Failed to save posts");
            }

            toast.success(`${data.count}개 포스트가 예약되었습니다! 🎉`);

            // Refresh posts list
            await fetchPosts();
        } catch (error) {
            console.error("Error parsing/saving file:", error);
            toast.error(error instanceof Error ? error.message : "파일 처리 실패");
        } finally {
            setIsLoading(false);
        }
    }, [insertAtFront]);

    const handleDeletePost = useCallback(async (postId: string) => {
        try {
            const response = await fetch(`/api/posts/${postId}`, {
                method: "DELETE",
            });

            if (!response.ok) {
                throw new Error("Failed to delete post");
            }

            setPosts((prev) => prev.filter((p) => p.id !== postId));
            toast.success("포스트 삭제됨");
        } catch (error) {
            console.error("Delete error:", error);
            toast.error("삭제 실패");
        }
    }, []);

    const handleReset = useCallback(async () => {
        if (!confirm("모든 PENDING 포스트를 삭제하시겠습니까?")) return;

        try {
            const response = await fetch("/api/posts/reset", { method: "DELETE" });
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "Reset failed");
            }

            await fetchPosts();
            toast.info(`${data.count}개 대기 중인 포스트 삭제됨`);
        } catch (error) {
            console.error("Reset error:", error);
            toast.error("초기화 실패");
        }
    }, []);

    const pendingCount = posts.filter((p) => p.status === "PENDING").length;
    const publishedCount = posts.filter((p) => p.status === "PUBLISHED").length;
    const failedCount = posts.filter((p) => p.status === "FAILED").length;

    // Convert DBPost to ParsedPost for PostCard
    const convertToCardPost = (dbPost: DBPost): ParsedPost => ({
        content: dbPost.content,
        images: dbPost.imageUrls,
        scheduledAt: new Date(dbPost.scheduledAt),
    });

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-violet-50 dark:from-slate-950 dark:via-slate-900 dark:to-violet-950">
            <Toaster position="top-center" richColors />

            {/* Header */}
            <header className="sticky top-0 z-50 backdrop-blur-lg bg-white/70 dark:bg-slate-900/70 border-b border-slate-200 dark:border-slate-800">
                <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl shadow-lg shadow-violet-500/30">
                            <Sparkles className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-slate-800 dark:text-white">
                                Threads 자동 업로드
                            </h1>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                즉시 업로드 & 예약 발행
                            </p>
                        </div>
                    </div>

                    {posts.length > 0 && (
                        <div className="flex items-center gap-3">
                            {/* Status badges */}
                            <div className="flex items-center gap-2">
                                {pendingCount > 0 && (
                                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded-full text-sm font-medium">
                                        <Calendar className="w-4 h-4" />
                                        {pendingCount} 예약
                                    </div>
                                )}
                                {publishedCount > 0 && (
                                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full text-sm font-medium">
                                        <CheckCircle2 className="w-4 h-4" />
                                        {publishedCount} 완료
                                    </div>
                                )}
                                {failedCount > 0 && (
                                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-full text-sm font-medium">
                                        <AlertCircle className="w-4 h-4" />
                                        {failedCount} 실패
                                    </div>
                                )}
                            </div>

                            <Button variant="outline" size="sm" onClick={fetchPosts} disabled={isFetching}>
                                <RefreshCw className={`w-4 h-4 mr-1.5 ${isFetching ? 'animate-spin' : ''}`} />
                                새로고침
                            </Button>
                            <Button variant="outline" size="sm" onClick={handleReset}>
                                <RotateCcw className="w-4 h-4 mr-1.5" />
                                초기화
                            </Button>
                        </div>
                    )}
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-6xl mx-auto px-4 py-8">
                {isFetching && posts.length === 0 ? (
                    <div className="flex items-center justify-center py-20">
                        <RefreshCw className="w-8 h-8 animate-spin text-violet-500" />
                    </div>
                ) : posts.length === 0 ? (
                    <div className="space-y-4">
                        <FileDropzone onFileSelect={handleFileSelect} isLoading={isLoading} />
                        <div className="flex items-center gap-3 p-5 bg-white dark:bg-slate-800 rounded-xl border border-violet-200 dark:border-violet-800 shadow-sm">
                            <Wand2 className="w-5 h-5 text-violet-500 shrink-0" />
                            <span className="text-sm text-slate-600 dark:text-slate-300 flex-1">파일 없이 AI로 바로 생성</span>
                            <input
                                type="number"
                                min={7} max={300} step={7}
                                value={generateCount}
                                onChange={(e) => setGenerateCount(Number(e.target.value))}
                                className="w-20 px-2 py-1 text-sm border border-slate-200 dark:border-slate-600 rounded-lg text-center bg-transparent"
                            />
                            <span className="text-xs text-slate-400">개</span>
                            <Button
                                onClick={handleGenerate}
                                disabled={isGenerating}
                                className="bg-violet-600 hover:bg-violet-700 text-white"
                            >
                                {isGenerating ? <RefreshCw className="w-4 h-4 mr-1.5 animate-spin" /> : <Wand2 className="w-4 h-4 mr-1.5" />}
                                {isGenerating ? "생성 중..." : "AI 생성"}
                            </Button>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {/* Summary Bar */}
                        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between p-4 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
                            <div className="flex items-center gap-4">
                                <div className="text-sm">
                                    <span className="font-semibold text-slate-700 dark:text-slate-200">
                                        {posts.filter(p => showPublished ? true : p.status !== "PUBLISHED").length}
                                    </span>
                                    <span className="text-slate-500 dark:text-slate-400">
                                        개 포스트
                                        {!showPublished && publishedCount > 0 && ` (+완료 ${publishedCount}개 숨김)`}
                                    </span>
                                </div>
                                <div className="h-4 w-px bg-slate-200 dark:bg-slate-700" />
                                <div className="flex items-center gap-2">
                                    <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 cursor-pointer select-none">
                                        <input
                                            type="checkbox"
                                            checked={showPublished}
                                            onChange={(e) => setShowPublished(e.target.checked)}
                                            className="rounded border-slate-300 text-violet-600 focus:ring-violet-500"
                                        />
                                        완료된 글 보기
                                    </label>
                                </div>
                            </div>

                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full sm:w-auto">
                                <label className="flex items-center justify-between sm:justify-start gap-2 px-3 py-2 sm:p-0 bg-slate-50 dark:bg-slate-900 sm:bg-transparent rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 cursor-pointer select-none">
                                    <span>맨 앞으로 추가</span>
                                    <div className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={insertAtFront}
                                            onChange={(e) => setInsertAtFront(e.target.checked)}
                                            className="sr-only peer"
                                        />
                                        <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-slate-600 peer-checked:bg-violet-600"></div>
                                    </div>
                                </label>
                                <div className="flex items-center gap-2 flex-wrap">
                                    <Button
                                        size="sm"
                                        onClick={handleGenerate}
                                        disabled={isGenerating}
                                        className="bg-violet-600 hover:bg-violet-700 text-white flex-1 sm:flex-none"
                                    >
                                        {isGenerating ? <RefreshCw className="w-4 h-4 mr-1.5 animate-spin" /> : <Wand2 className="w-4 h-4 mr-1.5" />}
                                        {isGenerating ? "생성 중..." : `AI ${generateCount}개 생성`}
                                    </Button>
                                    <Button
                                        variant="default"
                                        size="sm"
                                        onClick={handleCreatePost}
                                        className="bg-slate-600 hover:bg-slate-700 text-white flex-1 sm:flex-none"
                                    >
                                        <Pencil className="w-4 h-4 mr-1.5" />
                                        글 작성
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => document.querySelector<HTMLInputElement>('input[type="file"]')?.click()}
                                        className="flex-1 sm:flex-none"
                                    >
                                        <Upload className="w-4 h-4 mr-1.5" />
                                        파일 추가
                                    </Button>
                                </div>
                            </div>
                            <input
                                type="file"
                                accept=".xlsx,.md"
                                className="hidden"
                                onChange={(e) => {
                                    if (e.target.files?.[0]) {
                                        handleFileSelect(e.target.files[0]);
                                    }
                                }}
                            />
                        </div>

                        {/* Posts Grid */}
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {posts
                                .filter(p => showPublished ? true : p.status !== "PUBLISHED")
                                .map((dbPost, index) => (
                                    <PostCard
                                        key={dbPost.id}
                                        post={convertToCardPost(dbPost)}
                                        index={index}
                                        isPosted={dbPost.status === "PUBLISHED"}
                                        dbPostId={dbPost.id}
                                        status={dbPost.status}
                                        threadsId={dbPost.threadsId}
                                        errorLog={dbPost.errorLog}
                                        onUpdate={() => { }}
                                        onDelete={() => handleDeletePost(dbPost.id)}
                                        onRefresh={fetchPosts}
                                    />
                                ))}
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}

