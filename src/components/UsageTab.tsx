import React, { useState } from "react";
import { UsageHistory, VpnStatus } from "../types/config";
import { formatBytes } from "../utils/formatters";
import {
  BarChart3,
  Calendar,
  RotateCcw,
  TrendingUp,
  HardDrive,
  Activity,
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

  // Generate last 30 days keys
  const days: string[] = [];
  const today = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }

  // Today key and Month key
  const todayKey = today.toISOString().slice(0, 10);
  const monthKey = today.toISOString().slice(0, 7);

  // Today's record
  const todayTotal = history.daily[todayKey] || 0;

  // Month's record
  const monthTotal = history.monthly[monthKey] || 0;

  // All time
  let allTimeTotal = 0;
  Object.values(history.daily).forEach((bytes) => {
    allTimeTotal += bytes;
  });

  // Max bytes for 30-day chart scaling
  const chartData = days.map((date) => {
    const total = history.daily[date] || 0;
    return {
      date,
      total,
    };
  });

  const maxTotalBytes = Math.max(...chartData.map((d) => d.total), 1024 * 1024 * 50); // Min scale 50MB

  return (
    <div className="flex-1 flex flex-col p-6 overflow-y-auto space-y-6">
      {/* Top Header & Actions */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-indigo-400" />
            Bandwidth & Usage Statistics
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Real-time local data consumption collected via Xray-core StatsService.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onRefreshHistory()}
            className="px-3 py-1.5 bg-gray-900 border border-gray-800 hover:bg-gray-800 text-gray-300 rounded-xl text-xs font-semibold transition-colors"
          >
            Refresh
          </button>
          <button
            onClick={() => setShowResetConfirm(true)}
            className="px-3 py-1.5 bg-rose-950/40 border border-rose-800/60 hover:bg-rose-900/60 text-rose-300 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset Data
          </button>
        </div>
      </div>

      {/* Overview Stat Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Today */}
        <div className="bg-gray-900/60 border border-gray-800/80 rounded-2xl p-4 flex flex-col justify-between gap-3 shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Today's Usage
            </span>
            <div className="w-7 h-7 rounded-lg bg-indigo-600/20 text-indigo-400 flex items-center justify-center">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-xl font-bold font-mono text-white">
              {formatBytes(todayTotal)}
            </div>
            <div className="text-[11px] text-gray-400 mt-1">
              Active day total
            </div>
          </div>
        </div>

        {/* This Month */}
        <div className="bg-gray-900/60 border border-gray-800/80 rounded-2xl p-4 flex flex-col justify-between gap-3 shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              This Month
            </span>
            <div className="w-7 h-7 rounded-lg bg-emerald-600/20 text-emerald-400 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-xl font-bold font-mono text-white">
              {formatBytes(monthTotal)}
            </div>
            <div className="text-[11px] text-gray-400 mt-1">
              Cumulative monthly total
            </div>
          </div>
        </div>

        {/* All-time */}
        <div className="bg-gray-900/60 border border-gray-800/80 rounded-2xl p-4 flex flex-col justify-between gap-3 shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              All-Time Total
            </span>
            <div className="w-7 h-7 rounded-lg bg-purple-600/20 text-purple-400 flex items-center justify-center">
              <HardDrive className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-xl font-bold font-mono text-white">{formatBytes(allTimeTotal)}</div>
            <div className="text-[11px] text-gray-400 mt-1">
              Historical consumption
            </div>
          </div>
        </div>

        {/* Current Active Session */}
        <div className="bg-gray-900/60 border border-gray-800/80 rounded-2xl p-4 flex flex-col justify-between gap-3 shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Current Session
            </span>
            <div className="w-7 h-7 rounded-lg bg-cyan-600/20 text-cyan-400 flex items-center justify-center">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-xl font-bold font-mono text-white">
              {formatBytes(status.sessionBytesUplink + status.sessionBytesDownlink)}
            </div>
            <div className="flex items-center gap-3 text-[11px] text-gray-400 mt-1">
              <span className="flex items-center gap-1 text-emerald-400">
                <ArrowDown className="w-3 h-3" /> {formatBytes(status.sessionBytesDownlink)}
              </span>
              <span className="flex items-center gap-1 text-cyan-400">
                <ArrowUp className="w-3 h-3" /> {formatBytes(status.sessionBytesUplink)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 30-Day Interactive Bar Chart */}
      <div className="bg-gray-900/60 border border-gray-800/80 rounded-2xl p-5 shadow-lg flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <span>30-Day Daily Activity</span>
            <span className="text-[11px] font-normal text-gray-400 font-mono">
              (Peak: {formatBytes(maxTotalBytes)})
            </span>
          </h3>

          {hoveredDay && (
            <div className="text-xs font-mono bg-gray-800 px-3 py-1 rounded-lg border border-gray-700 text-indigo-300 animate-fadeIn">
              <span className="font-semibold text-white">{hoveredDay.date}:</span>{" "}
              {formatBytes(hoveredDay.total)}
            </div>
          )}
        </div>

        {/* Custom SVG Bar Chart */}
        <div className="h-44 w-full flex items-end gap-1.5 pt-4 pb-2 px-1 relative">
          {chartData.map((d) => {
            const heightPct = Math.max((d.total / maxTotalBytes) * 100, 3);
            const isToday = d.date === todayKey;
            const hasData = d.total > 0;

            return (
              <div
                key={d.date}
                onMouseEnter={() => setHoveredDay(d)}
                onMouseLeave={() => setHoveredDay(null)}
                className="flex-1 h-full flex flex-col justify-end items-center group relative cursor-pointer"
              >
                {/* Bar */}
                <div
                  style={{ height: `${heightPct}%` }}
                  className={`w-full rounded-t-md transition-all duration-300 ${
                    hasData
                      ? isToday
                        ? "bg-gradient-to-t from-indigo-600 to-cyan-400 group-hover:from-indigo-500 group-hover:to-cyan-300 shadow-sm shadow-cyan-500/30"
                        : "bg-gradient-to-t from-indigo-900 to-indigo-500 group-hover:from-indigo-800 group-hover:to-indigo-400"
                      : "bg-gray-800/40 group-hover:bg-gray-700/60"
                  }`}
                />
              </div>
            );
          })}
        </div>

        {/* Date Labels (Start, Middle, End) */}
        <div className="flex items-center justify-between text-[10px] text-gray-500 font-mono border-t border-gray-800/60 pt-2 px-1">
          <span>{days[0]}</span>
          <span>{days[14]}</span>
          <span className="text-indigo-400 font-semibold">{todayKey} (Today)</span>
        </div>
      </div>

      {/* Reset Confirmation Dialog */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
          <div className="bg-[#111827] border border-gray-800 rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <AlertTriangle className="w-6 h-6" />
              <h3 className="text-base font-bold text-white">Reset All Usage Statistics?</h3>
            </div>
            <p className="text-xs text-gray-300">
              This will permanently delete all recorded daily and monthly upload/download totals stored in
              HyperVPN. Active session stats will also reset to zero.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setShowResetConfirm(false)}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs font-semibold rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  await onResetHistory();
                  setShowResetConfirm(false);
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-rose-950 transition-colors"
              >
                Confirm Reset
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
