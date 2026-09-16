import React, { useState } from "react";
import { UsageHistory, VpnStatus } from "../types/config";
import { formatBytes } from "../utils/formatters";
import {
  RotateCcw,
  RefreshCw,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
} from "lucide-react";

interface UsageTabProps {
  history: UsageHistory;
  status: VpnStatus;
  onResetHistory: () => Promise<void>;
  onRefreshHistory: () => Promise<void>;
}

export const UsageTab: React.FC<UsageTabProps> = ({
  history,
  status,
  onResetHistory,
  onRefreshHistory,
}) => {
  const [hoveredDay, setHoveredDay] = useState<{
    date: string;
    total: number;
  } | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Generate last 30 days keys
  const days: string[] = [];
  const today = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }

  const todayKey = today.toISOString().slice(0, 10);
  const monthKey = today.toISOString().slice(0, 7);

  const todayTotal = history.daily[todayKey] || 0;
  const monthTotal = history.monthly[monthKey] || 0;

  let allTimeTotal = 0;
  Object.values(history.daily).forEach((bytes) => {
    allTimeTotal += bytes;
  });

  const chartData = days.map((date) => {
    const total = history.daily[date] || 0;
    return {
      date,
      total,
    };
  });

  const maxTotalBytes = Math.max(...chartData.map((d) => d.total), 1024 * 1024 * 50);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await onRefreshHistory();
    setIsRefreshing(false);
  };

  return (
    <div className="flex-1 flex flex-col p-3.5 overflow-y-auto space-y-3 select-none">
      {/* Top Header & Actions */}
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-300">
          Data Usage
        </h2>

        <div className="flex items-center gap-1.5">
          <button
            onClick={handleRefresh}
            className="p-1.5 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 rounded-lg text-xs transition-colors"
            title="Refresh statistics"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={() => setShowResetConfirm(true)}
            className="px-2.5 py-1 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-lg text-xs font-medium transition-colors flex items-center gap-1"
          >
            <RotateCcw className="w-3 h-3" />
            Reset
          </button>
        </div>
      </div>

      {/* 2x2 Stats Grid */}
      <div className="grid grid-cols-2 gap-2">
        {/* Today */}
        <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-3 flex flex-col justify-between gap-1">
          <span className="text-[10px] font-semibold text-zinc-500 uppercase">
            Today
          </span>
          <div className="text-sm font-bold font-mono text-white">
            {formatBytes(todayTotal)}
          </div>
        </div>

        {/* This Month */}
        <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-3 flex flex-col justify-between gap-1">
          <span className="text-[10px] font-semibold text-zinc-500 uppercase">
            This Month
          </span>
          <div className="text-sm font-bold font-mono text-white">
            {formatBytes(monthTotal)}
          </div>
        </div>

        {/* All-time */}
        <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-3 flex flex-col justify-between gap-1">
          <span className="text-[10px] font-semibold text-zinc-500 uppercase">
            All-Time Total
          </span>
          <div className="text-sm font-bold font-mono text-white">
            {formatBytes(allTimeTotal)}
          </div>
        </div>

        {/* Current Active Session */}
        <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-3 flex flex-col justify-between gap-1">
          <span className="text-[10px] font-semibold text-zinc-500 uppercase">
            Session
          </span>
          <div className="text-sm font-bold font-mono text-white truncate">
            {formatBytes(status.sessionBytesUplink + status.sessionBytesDownlink)}
          </div>
          <div className="flex items-center gap-2 text-[9px] font-mono text-zinc-400">
            <span className="flex items-center gap-0.5">
              <ArrowDown className="w-2.5 h-2.5 text-zinc-400" />
              {formatBytes(status.sessionBytesDownlink, 0)}
            </span>
            <span className="flex items-center gap-0.5">
              <ArrowUp className="w-2.5 h-2.5 text-zinc-400" />
              {formatBytes(status.sessionBytesUplink, 0)}
            </span>
          </div>
        </div>
      </div>

      {/* 30-Day Activity Bar Chart */}
      <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-3 flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-zinc-300">
            30-Day Activity
          </span>
          {hoveredDay ? (
            <span className="text-[10px] font-mono text-zinc-300 bg-zinc-800 px-1.5 py-0.5 rounded border border-zinc-700">
              {hoveredDay.date.slice(5)}: {formatBytes(hoveredDay.total)}
            </span>
          ) : (
            <span className="text-[10px] font-mono text-zinc-500">
              Peak: {formatBytes(maxTotalBytes)}
            </span>
          )}
        </div>

        {/* SVG/CSS Bar Chart */}
        <div className="h-28 w-full flex items-end gap-1 pt-2 pb-1 relative">
          {chartData.map((d) => {
            const heightPct = Math.max((d.total / maxTotalBytes) * 100, 4);
            const isToday = d.date === todayKey;
            const hasData = d.total > 0;

            return (
              <div
                key={d.date}
                onMouseEnter={() => setHoveredDay(d)}
                onMouseLeave={() => setHoveredDay(null)}
                className="flex-1 h-full flex flex-col justify-end items-center group relative cursor-pointer"
              >
                <div
                  style={{ height: `${heightPct}%` }}
                  className={`w-full rounded-t-sm transition-all duration-150 ${
                    hasData
                      ? isToday
                        ? "bg-white group-hover:bg-zinc-200"
                        : "bg-zinc-600 group-hover:bg-zinc-400"
                      : "bg-zinc-800/50 group-hover:bg-zinc-700/50"
                  }`}
                />
              </div>
            );
          })}
        </div>

        {/* Date Labels */}
        <div className="flex items-center justify-between text-[9px] text-zinc-500 font-mono border-t border-zinc-800/80 pt-1.5">
          <span>{days[0].slice(5)}</span>
          <span>{days[14].slice(5)}</span>
          <span className="text-zinc-300 font-medium">Today</span>
        </div>
      </div>

      {/* Reset Confirmation Dialog */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-xs shadow-2xl p-4 space-y-3">
            <div className="flex items-center gap-2 text-zinc-200">
              <AlertTriangle className="w-4 h-4 text-zinc-400" />
              <h3 className="text-xs font-bold">Reset All Usage Data?</h3>
            </div>
            <p className="text-xs text-zinc-400">
              This will reset all daily and monthly bandwidth records back to zero.
            </p>
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                onClick={() => setShowResetConfirm(false)}
                className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  await onResetHistory();
                  setShowResetConfirm(false);
                }}
                className="px-3 py-1.5 bg-white hover:bg-zinc-200 text-black text-xs font-bold rounded-lg transition-colors"
              >
                Reset
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
