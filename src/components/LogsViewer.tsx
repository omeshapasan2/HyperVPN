import React, { useState, useRef, useEffect } from "react";
import { LogEntry } from "../types/config";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import {
  Search,
  Trash2,
  Copy,
  Check,
  RotateCw,
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
  const [autoScroll] = useState(true);
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
      .map((l) => `[${new Date(l.timestamp).toLocaleTimeString()}] [${l.source.toUpperCase()}] [${l.level.toUpperCase()}] ${l.message}`)
      .join("\n");
    await writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex-1 flex flex-col p-3.5 overflow-hidden space-y-2.5">
      {/* Header & Controls */}
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-300">
          Process Logs
        </h2>

        <div className="flex items-center gap-1">
          <button
            onClick={() => onRefreshLogs()}
            className="p-1.5 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-lg text-xs transition-colors"
            title="Refresh Logs"
          >
            <RotateCw className="w-3 h-3" />
          </button>
          <button
            onClick={handleCopyLogs}
            className="p-1.5 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-lg text-xs transition-colors"
            title="Copy all logs"
          >
            {copied ? <Check className="w-3 h-3 text-white" /> : <Copy className="w-3 h-3" />}
          </button>
          <button
            onClick={onClearLogs}
            className="p-1.5 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-lg text-xs transition-colors"
            title="Clear logs"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex items-center gap-1.5">
        <div className="relative flex-1">
          <Search className="w-3 h-3 text-zinc-500 absolute left-2 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            placeholder="Search logs..."
            className="w-full pl-6 pr-2 py-1 bg-zinc-900/80 border border-zinc-800 rounded-lg text-[11px] text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 font-mono"
          />
        </div>

        {/* Level Filters */}
        <div className="flex items-center bg-zinc-900 p-0.5 rounded-lg border border-zinc-800 shrink-0">
          {(["all", "info", "warn", "error"] as const).map((lvl) => (
            <button
              key={lvl}
              onClick={() => setLevelFilter(lvl)}
              className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase transition-colors ${
                levelFilter === lvl
                  ? "bg-zinc-800 text-white border border-zinc-700 shadow-sm"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {lvl === "all" ? "All" : lvl.slice(0, 3)}
            </button>
          ))}
        </div>
      </div>

      {/* Monospace Log Viewer Terminal */}
      <div className="flex-1 bg-zinc-950 border border-zinc-800/90 rounded-xl p-2.5 overflow-y-auto font-mono text-[10px] leading-relaxed select-text space-y-1 shadow-inner">
        {filteredLogs.length === 0 ? (
          <div className="h-full flex items-center justify-center text-zinc-600 italic">
            No log entries recorded.
          </div>
        ) : (
          filteredLogs.map((entry, idx) => (
            <div key={idx} className="flex items-start gap-1.5 hover:bg-zinc-900/50 px-1 py-0.5 rounded">
              <span className="text-zinc-600 shrink-0 select-none">
                {new Date(entry.timestamp).toLocaleTimeString()}
              </span>

              <span className="text-zinc-400 font-semibold shrink-0">
                [{entry.source}]
              </span>

              <span className="text-zinc-300 break-all whitespace-pre-wrap flex-1">
                {entry.message}
              </span>
            </div>
          ))
        )}
        <div ref={terminalEndRef} />
      </div>
    </div>
  );
};
