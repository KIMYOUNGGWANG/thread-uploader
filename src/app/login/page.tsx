"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, Sparkles, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success("로그인 성공! 대시보드로 이동합니다.");
        router.push("/");
        router.refresh();
      } else {
        setError(data.error || "비밀번호가 올바르지 않습니다.");
        toast.error(data.error || "로그인 실패");
      }
    } catch (err) {
      setError("서버 오류가 발생했습니다. 다시 시도해 주세요.");
      toast.error("연결 오류");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-violet-950 to-slate-950 px-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-violet-600/20 rounded-full blur-[100px]" />
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-indigo-600/20 rounded-full blur-[100px]" />
      </div>

      <Card className="w-full max-w-md bg-slate-900/40 border-slate-800 backdrop-blur-xl shadow-2xl relative z-10">
        <CardHeader className="space-y-1 text-center">
          <div className="mx-auto w-12 h-12 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-violet-500/20 mb-4">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight text-white">
            Threads Uploader
          </CardTitle>
          <CardDescription className="text-slate-400">
            접근 권한이 필요합니다. 관리자 비밀번호를 입력하세요.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleLogin}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                <Input
                  type="password"
                  placeholder="Admin Password"
                  className="pl-10 bg-slate-950/50 border-slate-700 text-white placeholder:text-slate-600 focus:ring-violet-500"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoFocus
                />
              </div>
              {error && (
                <div className="flex items-center gap-2 text-sm text-red-500 bg-red-500/10 p-2 rounded-lg border border-red-500/20 animate-in fade-in slide-in-from-top-1">
                  <AlertCircle className="w-4 h-4" />
                  {error}
                </div>
              )}
            </div>
          </CardContent>
          <CardFooter>
            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-semibold shadow-lg shadow-violet-600/20 h-11"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  로그인 중...
                </>
              ) : (
                "Dashboard 입장"
              )}
            </Button>
          </CardFooter>
        </form>
      </Card>
      
      <p className="absolute bottom-8 text-slate-600 text-xs">
        &copy; 2026 Threads Uploader. Private Access Only.
      </p>
    </div>
  );
}
