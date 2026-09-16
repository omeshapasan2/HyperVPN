import React, { useState, useRef, useEffect } from "react";
import { LogEntry } from "../types/config";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import {
  Terminal,
  Search,
  Trash2,
  Copy,
  Check,
  RotateCw,
  ArrowDownCircle,
} from "lucide-react";

interface LogsViewerProps {
  logs: LogEntry[];
  onClearLogs: () => void;
  onRefreshLogs: () => Promise<void>;
}

export const LogsViewer: React.FC<LogsViewerProps> = ({
  logs,
  onClearLogs,
  onRefreshLogs,
}) => {
  const [filterQuery, setFilterQuery] = useState("");
  const [levelFilter, setLevelFilter] = useState<"all" | "info" | "warn" | "error">("all");
  const [autoScroll, setAutoScroll] = useState(true);
  const [copied, setCopied] = useState(false);

  const terminalEndRef = useRef<HTMLDivElement>(null);

  const filteredLogs = logs.filter((l) => {
    if (levelFilter !== "all" && l.level !== levelFilter) return false;
    if (filterQuery.trim()) {
      const q = filterQuery.toLowerCase();
      return (
        l.message.toLowerCase().includes(q) ||
        l.source.toLowerCase().includes(q) ||
        l.level.toLowerCase().includes(q)
      );
    }
    return true;
  });

  useEffect(() => {
    if (autoScroll && terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs, autoScroll]);

  const handleCopyLogs = async () => {
    const text = logs
      .map((l) => `[${l.timestamp}] [${l.source.toUpperCase()}] [${l.level.toUpperCase()}] ${l.message}`)
      .join("\n");
    await writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getLevelColor = (level: string) => {
    switch (level) {
      case "error":
        return "text-rose-400 bg-rose-950/60 border-rose-800/80";
      case "warn":
        return "text-amber-400 bg-amber-950/60 border-amber-800/80";
      default:
        return "text-indigo-400 bg-indigo-950/60 border-indigo-800/80";
    }
  };

  const getSourceColor = (source: string) => {
    switch (source) {
      case "xray":
        return "text-purple-400";
      case "tun2socks":
        return "text-cyan-400";
      default:
        return "text-gray-400";
    }
  };

  return (
    <div className="flex-1 flex flex-col p-6 overflow-hidden space-y-4">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shrink-0">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Terminal className="w-5 h-5 text-indigo-400" />
            Process & System Logs
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Real-time stdout/stderr streams from Xray-core, tun2socks, and routing operations.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => onRefreshLogs()}
            className="p-1.5 bg-gray-900 border border-gray-800 hover:bg-gray-800 text-gray-300 rounded-lg text-xs transition-colors"
            title="Refresh Logs"
          >
            <RotateCw className="w-4 h-4" />
          </button>
          <button
            onClick={handleCopyLogs}
            className="px-3 py-1.5 bg-gray-900 border border-gray-800 hover:bg-gray-800 text-gray-300 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5"
            title="Copy all logs to clipboard"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? "Copied" : "Copy"}
          </button>
          <button
            onClick={onClearLogs}
            className="px-3 py-1.5 bg-rose-950/40 border border-rose-800/60 hover:bg-rose-900/60 text-rose-300 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 shrink-0 bg-gray-900/60 border border-gray-800/80 p-2.5 rounded-xl">
        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            placeholder="Search log messages..."
            className="w-full pl-8 pr-3 py-1 bg-gray-950 border border-gray-800 rounded-lg text-xs text-gray-200 placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        {/* Level Filters */}
        <div className="flex items-center gap-1">
          {(["all", "info", "warn", "error"] as const).map((lvl) => (
            <button
              key={lvl}
              onClick={() => setLevelFilter(lvl)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold uppercase tracking-wider transition-colors ${
                levelFilter === lvl
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-gray-400 hover:text-white hover:bg-gray-800"
              }`}
            >
              {lvl}
            </button>
          ))}
        </div>

        {/* Auto Scroll Toggle */}
        <button
          onClick={() => setAutoScroll(!autoScroll)}
          className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
            autoScroll ? "text-indigo-400 bg-indigo-950/50 border border-indigo-800/60" : "text-gray-500"
          }`}
        >
          <ArrowDownCircle className="w-3.5 h-3.5" />
          Auto-scroll
        </button>
      </div>

      {/* Monospace Log Viewer Terminal */}
      <div className="flex-1 bg-[#0a0f1d] border border-gray-800/90 rounded-2xl p-4 overflow-y-auto font-mono text-[11px] leading-relaxed select-text space-y-1 shadow-inner">
        {filteredLogs.length === 0 ? (
          <div className="h-full flex items-center justify-center text-gray-600 italic">
            No log entries recorded yet.
          </div>
        ) : (
          filteredLogs.map((entry, idx) => (
            <div key={idx} className="flex items-start gap-2 hover:bg-gray-900/40 px-1 py-0.5 rounded">
              {/* Timestamp */}
              <span className="text-gray-600 shrink-0 select-none">[{entry.timestamp}]</span>

              {/* Source badge */}
              <span className={`font-semibold shrink-0 ${getSourceColor(entry.source)}`}>
                [{entry.source.toUpperCase()}]
              </span>

              {/* Level pill */}
              <span
                className={`text-[9px] uppercase px-1 py-0.2 rounded border font-semibold shrink-0 ${getLevelColor(
                  entry.level
                )}`}
              >
                {entry.level}
              </span>

              {/* Message */}
              <span className="text-gray-300 break-all whitespace-pre-wrap">{entry.message}</span>
            </div>
          ))
        )}
        <div ref={terminalEndRef} />
      </div>
    </div>
  );
};
