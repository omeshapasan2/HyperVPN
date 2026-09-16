import React, { useState } from "react";
import { VlessConfig } from "../types/config";
import { formatLatency } from "../utils/formatters";
import {
  Activity,
  Check,
  Copy,
  Edit2,
  Trash2,
  Zap,
} from "lucide-react";

interface ConfigCardProps {
  config: VlessConfig;
  isActive: boolean;
  isConnected: boolean;
  isPinging: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onPing: () => void;
  onCopyUri: () => Promise<boolean>;
}

export const ConfigCard: React.FC<ConfigCardProps> = ({
  config,
  isActive,
  isConnected,
  isPinging,
  onSelect,
  onEdit,
  onDelete,
  onPing,
  onCopyUri,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const ok = await onCopyUri();
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const latencyInfo = formatLatency(config.latency);

  return (
    <div
      onClick={onSelect}
      className={`group rounded-xl p-3 transition-all duration-150 cursor-pointer border flex flex-col gap-2 select-none ${
        isActive
          ? "bg-zinc-800/90 border-zinc-500 shadow-sm"
          : "bg-zinc-900/60 hover:bg-zinc-900/90 border-zinc-800/80 hover:border-zinc-700"
      }`}
    >
      {/* Top row: Radio + Remark + Actions */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2.5 min-w-0">
          {/* Active selection radio */}
          <div className="pt-0.5">
            <div
              className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center transition-colors ${
                isActive
                  ? "border-white bg-white"
                  : "border-zinc-600 group-hover:border-zinc-500"
              }`}
            >
              {isActive && <div className="w-1.5 h-1.5 rounded-full bg-black" />}
            </div>
          </div>

          {/* Title & Host info */}
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h3 className="text-xs font-bold text-white truncate group-hover:text-zinc-200">
                {config.remark || "Unnamed Server"}
              </h3>
              {isActive && isConnected && (
                <span className="text-[9px] font-bold bg-white text-black px-1 py-0.2 rounded shrink-0">
                  ACTIVE
                </span>
              )}
            </div>
            <div className="text-[11px] text-zinc-400 font-mono truncate mt-0.5">
              {config.host}:{config.port}
            </div>
          </div>
        </div>

        {/* Quick action buttons */}
        <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={onPing}
            disabled={isPinging}
            title="Ping server"
            className="p-1 rounded text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors disabled:opacity-40"
          >
            <Activity className={`w-3.5 h-3.5 ${isPinging ? "animate-spin text-white" : ""}`} />
          </button>
          <button
            onClick={handleCopy}
            title="Copy vless:// URI"
            className="p-1 rounded text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-white" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={onEdit}
            title="Edit"
            className="p-1 rounded text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onDelete}
            title="Delete"
            className="p-1 rounded text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Meta tags row */}
      <div className="flex items-center justify-between gap-1 text-[10px] pt-0.5 border-t border-zinc-800/60 font-mono">
        <div className="flex items-center gap-1.5 truncate">
          <span className="px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-300 border border-zinc-700 uppercase font-semibold">
            {config.security}
          </span>
          {config.sni && (
            <span className="text-zinc-500 truncate max-w-[120px]">
              {config.sni}
            </span>
          )}
        </div>

        {/* Latency */}
        <span className={`flex items-center gap-0.5 shrink-0 ${latencyInfo.color}`}>
          <Zap className="w-2.5 h-2.5" />
          {latencyInfo.text}
        </span>
      </div>
    </div>
  );
};
