"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Search, ExternalLink, Sparkles, RefreshCw, Newspaper } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import type { NewsArticle } from "@/lib/news-rss";

interface NewsTrendingTabProps {
  brandId: string;
  onUseNewsForDraft: (prompt: string, title: string) => void;
}

const PRESET_TOPICS = [
  "인공지능 트렌드",
  "스타트업",
  "직장인 커리어",
  "생산성 툴",
  "경제 트렌드",
];

export function NewsTrendingTab({ brandId, onUseNewsForDraft }: NewsTrendingTabProps) {
  const [query, setQuery] = useState("인공지능 트렌드");
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchNews = useCallback(async (searchQuery: string) => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/news/rss?query=${encodeURIComponent(searchQuery)}&limit=6`);
      const data = await res.json();
      if (data.success && Array.isArray(data.articles)) {
        setArticles(data.articles);
      } else {
        toast.error("뉴스를 가져오지 못했습니다.");
      }
    } catch {
      toast.error("뉴스 검색 중 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchNews("인공지능 트렌드");
  }, [fetchNews]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    void fetchNews(query.trim());
  };

  const handleCreateDraftFromNews = (article: NewsArticle) => {
    const draftPrompt = `[실시간 뉴스 기반]\n헤드라인: "${article.cleanTitle}"\n출처: ${article.source}\n원문 링크: ${article.link}\n\n이 뉴스에 대한 실무자의 관점과 인사이트를 3줄로 요약한 스레드 초안을 작성합니다.`;
    onUseNewsForDraft(draftPrompt, article.cleanTitle);
    toast.success("뉴스 기반 초안 프롬프트가 적용되었습니다. [스레드 피드] 탭에서 확인하세요!");
  };

  return (
    <div className="space-y-6">
      {/* Search Header */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Newspaper className="w-5 h-5 text-indigo-500" />
          <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">
            실시간 트렌드 뉴스 큐레이션
          </h2>
          <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-medium">
            autoTHREADS 엔진
          </span>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
          구글/네이버 실시간 뉴스 RSS에서 화제의 헤드라인을 가져와, 나의 인사이트가 담긴 스레드를 즉시 작성합니다.
        </p>

        <form onSubmit={handleSearch} className="flex gap-2 mb-4">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="관심 키워드 검색 (예: 챗GPT, 스타트업 투자, 직장인 연봉)"
              className="pl-9 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700"
            />
          </div>
          <Button type="submit" disabled={isLoading} className="bg-indigo-600 hover:bg-indigo-700 text-white">
            {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : "검색"}
          </Button>
        </form>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-slate-400 mr-1">추천 토픽:</span>
          {PRESET_TOPICS.map((topic) => (
            <button
              key={topic}
              type="button"
              onClick={() => {
                setQuery(topic);
                void fetchNews(topic);
              }}
              className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                query === topic
                  ? "bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 font-medium"
                  : "bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100"
              }`}
            >
              {topic}
            </button>
          ))}
        </div>
      </div>

      {/* Articles Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <RefreshCw className="w-6 h-6 animate-spin text-indigo-500" />
        </div>
      ) : articles.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 text-slate-400 text-sm">
          검색된 최근 뉴스가 없습니다. 다른 키워드로 검색해 보세요.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {articles.map((article) => (
            <div
              key={article.id}
              className="flex flex-col justify-between bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm hover:border-indigo-200 dark:hover:border-indigo-800 transition-all group"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                    {article.source}
                  </span>
                  <a
                    href={article.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-slate-400 hover:text-indigo-600 flex items-center gap-1 transition-colors"
                  >
                    원문 보기 <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 leading-snug line-clamp-2 group-hover:text-indigo-600 transition-colors">
                  {article.cleanTitle}
                </h3>
              </div>

              <div className="pt-4 mt-2 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-end">
                <Button
                  size="sm"
                  onClick={() => handleCreateDraftFromNews(article)}
                  className="bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 text-xs gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  이 뉴스로 스레드 생성
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
