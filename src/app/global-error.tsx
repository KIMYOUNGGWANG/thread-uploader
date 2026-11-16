"use client";

import { useEffect } from "react";
import "./globals.css";

// 루트 layout까지 실패했을 때만 뜬다. layout을 대신하므로 html·body·전역 스타일을 직접 가진다.
export default function GlobalError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="ko">
      <body className="antialiased font-sans">
        <title>오류 | Portfolio Growth OS</title>
        <main className="min-h-screen flex flex-col items-center justify-center gap-3 bg-gradient-to-br from-slate-950 via-violet-950 to-slate-950 px-4 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-white break-keep text-balance">문제가 발생했습니다</h1>
          <p className="text-slate-400 break-keep text-balance">일시적인 오류일 수 있습니다. 잠시 후 다시 시도해 주세요.</p>
          <button
            type="button"
            onClick={() => retry()}
            className="mt-3 h-11 w-full max-w-xs rounded-md bg-gradient-to-r from-violet-600 to-indigo-600 font-semibold text-white transition-colors hover:from-violet-500 hover:to-indigo-500 outline-none focus-visible:ring-[3px] focus-visible:ring-violet-400/60"
          >
            다시 시도
          </button>
        </main>
      </body>
    </html>
  );
}
