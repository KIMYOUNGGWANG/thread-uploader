"use client";

import { useEffect } from "react";
import Link from "next/link";
import { RotateCw, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

// Next 16.3+: retry()는 세그먼트를 다시 가져와 다시 그린다. reset()은 다시 그리기만 해서 서버 에러가 그대로 재발한다.
export default function ErrorPage({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-violet-950 to-slate-950 px-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-violet-600/20 rounded-full blur-[100px]" />
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-indigo-600/20 rounded-full blur-[100px]" />
      </div>

      <Card className="w-full max-w-md bg-slate-900/40 border-slate-800 backdrop-blur-xl shadow-2xl relative z-10">
        <CardHeader className="space-y-2 text-center">
          <div className="mx-auto w-12 h-12 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-violet-500/20 mb-4">
            <TriangleAlert className="w-6 h-6 text-white" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight text-white">
            <h1 className="break-keep text-balance">문제가 발생했습니다</h1>
          </CardTitle>
          <CardDescription className="text-slate-400 leading-relaxed break-keep text-balance">
            일시적인 오류일 수 있습니다. 잠시 후 다시 시도해 주세요.
          </CardDescription>
        </CardHeader>

        <CardFooter className="flex-col gap-3">
          <Button
            type="button"
            onClick={() => retry()}
            className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-semibold shadow-lg shadow-violet-600/20 h-11 focus-visible:ring-violet-400/60"
          >
            <RotateCw />
            다시 시도
          </Button>
          <Link
            href="/"
            className="inline-flex h-11 items-center rounded-md px-3 text-sm text-slate-400 transition-colors hover:text-white outline-none focus-visible:ring-[3px] focus-visible:ring-violet-400/60"
          >
            홈으로 가기
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
