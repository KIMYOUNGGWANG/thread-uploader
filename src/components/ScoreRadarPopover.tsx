"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { Sparkles, AlertTriangle, CheckCircle2, ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ScoreDimension {
  name: string;
  score: number;
  maxScore: number;
  strengths?: string[];
  weaknesses?: string[];
}

export interface ScoreRadarPopoverProps {
  score: number; // 0 ~ 100
  pass?: boolean | null;
  dimensions?: {
    hookTension?: ScoreDimension;
    conversationDepth?: ScoreDimension;
    humanVoice?: ScoreDimension;
    penaltyRisk?: ScoreDimension;
    formatReadability?: ScoreDimension;
  } | null;
  actionableFixes?: string[];
  triggerClassName?: string;
}

const AXIS_CONFIG = [
  { key: "hookTension", label: "Hook", max: 25 },
  { key: "conversationDepth", label: "대화", max: 25 },
  { key: "humanVoice", label: "인간어조", max: 20 },
  { key: "penaltyRisk", label: "페널티안전", max: 15 },
  { key: "formatReadability", label: "가독성", max: 15 },
] as const;

export function ScoreRadarPopover({
  score,
  pass,
  dimensions,
  actionableFixes = [],
  triggerClassName,
}: ScoreRadarPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close on click outside or escape key
  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setIsOpen(false);
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  // SVG Radar geometry calculations (Center: 100, 100, Radius: 65)
  const radarGeometry = useMemo(() => {
    const cx = 100;
    const cy = 100;
    const radius = 65;
    const count = 5;

    // Grid concentric rings (0.33, 0.66, 1.0)
    const rings = [0.33, 0.66, 1.0].map((scale) => {
      return Array.from({ length: count }, (_, i) => {
        const angle = -Math.PI / 2 + (i * 2 * Math.PI) / count;
        const x = cx + radius * scale * Math.cos(angle);
        const y = cy + radius * scale * Math.sin(angle);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      }).join(" ");
    });

    // Axis lines
    const axisLines = Array.from({ length: count }, (_, i) => {
      const angle = -Math.PI / 2 + (i * 2 * Math.PI) / count;
      return {
        x1: cx,
        y1: cy,
        x2: cx + radius * Math.cos(angle),
        y2: cy + radius * Math.sin(angle),
        labelX: cx + (radius + 16) * Math.cos(angle),
        labelY: cy + (radius + 16) * Math.sin(angle),
        label: AXIS_CONFIG[i].label,
      };
    });

    // Data polygon points
    const dataPoints = AXIS_CONFIG.map((cfg, i) => {
      const dim = dimensions?.[cfg.key];
      const val = dim?.score ?? Math.round((cfg.max * score) / 100);
      const ratio = Math.max(0.1, Math.min(1.0, val / cfg.max));
      const angle = -Math.PI / 2 + (i * 2 * Math.PI) / count;
      const x = cx + radius * ratio * Math.cos(angle);
      const y = cy + radius * ratio * Math.sin(angle);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(" ");

    return { rings, axisLines, dataPoints };
  }, [score, dimensions]);

  // Color theme based on score threshold
  const isPassing = pass ?? score >= 80;
  const badgeTheme = isPassing
    ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/25"
    : score >= 70
    ? "bg-amber-500/15 text-amber-400 border-amber-500/30 hover:bg-amber-500/25"
    : "bg-rose-500/15 text-rose-400 border-rose-500/30 hover:bg-rose-500/25";

  const escapeVelocityProbability = Math.min(0.99, Math.max(0.1, score / 100));

  return (
    <div className="relative inline-block" ref={popoverRef}>
      {/* Trigger Badge */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={cn(
          "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border transition-all cursor-pointer shadow-sm",
          badgeTheme,
          triggerClassName
        )}
        title="클릭하여 5D 알고리즘 탈출 속도 레이더 분석 보기"
      >
        <Sparkles className="w-3 h-3" />
        <span>{score}점</span>
        <span className="text-[10px] opacity-75 font-normal">
          {isPassing ? "(탈출속도 확보)" : "(미달)"}
        </span>
      </button>

      {/* Popover Dropdown Card */}
      {isOpen && (
        <div
          className="absolute z-50 left-0 mt-2 w-80 sm:w-96 rounded-xl bg-slate-900/95 backdrop-blur-md border border-slate-800 shadow-2xl p-4 text-slate-200 animate-in fade-in zoom-in-95 duration-150"
          style={{ maxWidth: "calc(100vw - 32px)" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  "p-1.5 rounded-lg",
                  isPassing ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-400"
                )}
              >
                {isPassing ? (
                  <CheckCircle2 className="w-4 h-4" />
                ) : (
                  <AlertTriangle className="w-4 h-4" />
                )}
              </div>
              <div>
                <h4 className="text-sm font-semibold text-white">5D 알고리즘 탈출 분석</h4>
                <p className="text-[11px] text-slate-400">
                  탈출 확률: {Math.round(escapeVelocityProbability * 100)}% (피드 확산 지수)
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* SVG Radar Chart Visualizer */}
          <div className="py-2 flex justify-center">
            <svg width="200" height="200" viewBox="0 0 200 200" className="overflow-visible">
              {/* Concentric Grid Rings */}
              {radarGeometry.rings.map((points, idx) => (
                <polygon
                  key={idx}
                  points={points}
                  fill="none"
                  stroke="#334155"
                  strokeWidth="1"
                  strokeDasharray={idx < 2 ? "2 2" : undefined}
                />
              ))}

              {/* Axis Radii & Labels */}
              {radarGeometry.axisLines.map((axis, idx) => (
                <g key={idx}>
                  <line
                    x1={axis.x1}
                    y1={axis.y1}
                    x2={axis.x2}
                    y2={axis.y2}
                    stroke="#475569"
                    strokeWidth="1"
                  />
                  <text
                    x={axis.labelX}
                    y={axis.labelY}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className="text-[10px] fill-slate-400 font-medium"
                  >
                    {axis.label}
                  </text>
                </g>
              ))}

              {/* Evaluated Score Shape */}
              <polygon
                points={radarGeometry.dataPoints}
                fill={isPassing ? "rgba(16, 185, 129, 0.35)" : "rgba(244, 63, 94, 0.35)"}
                stroke={isPassing ? "#10b981" : "#f43f5e"}
                strokeWidth="2"
                className="transition-all duration-300"
              />
            </svg>
          </div>

          {/* Dimension Progress Bars */}
          <div className="space-y-1.5 pt-1 pb-3 border-b border-slate-800/80">
            {AXIS_CONFIG.map((cfg) => {
              const dim = dimensions?.[cfg.key];
              const val = dim?.score ?? Math.round((cfg.max * score) / 100);
              const pct = Math.round((val / cfg.max) * 100);
              return (
                <div key={cfg.key} className="flex items-center gap-2 text-xs">
                  <span className="w-16 text-slate-400 text-[11px] truncate">{cfg.label}</span>
                  <div className="flex-1 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-300",
                        pct >= 80 ? "bg-emerald-400" : pct >= 60 ? "bg-amber-400" : "bg-rose-400"
                      )}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="w-10 text-right font-mono text-[11px] text-slate-300">
                    {val}/{cfg.max}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Actionable Fixes Guide */}
          {actionableFixes.length > 0 && (
            <div className="mt-3">
              <span className="text-[11px] font-semibold text-amber-400/90 uppercase tracking-wider block mb-1">
                알고리즘 탈출을 위한 개선 권고
              </span>
              <ul className="space-y-1 text-xs text-slate-300">
                {actionableFixes.slice(0, 3).map((fix, idx) => (
                  <li key={idx} className="flex items-start gap-1.5">
                    <ChevronRight className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                    <span className="leading-snug text-[11px]">{fix}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
