import React, { useState } from "react";
import { VlessConfig } from "../types/config";
import { formatLatency } from "../utils/formatters";
import {
  Activity,
  Check,
  Copy,
  Edit2,
  Globe,
  Trash2,
  Zap,
  Lock,
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
      className={`group relative rounded-2xl p-4 transition-all duration-200 cursor-pointer border flex flex-col justify-between gap-3 select-none ${
        isActive
          ? "bg-gradient-to-b from-gray-900 to-indigo-950/40 border-indigo-500/50 shadow-lg shadow-indigo-950/50 ring-1 ring-indigo-500/20"
          : "bg-gray-900/60 hover:bg-gray-900/90 border-gray-800/80 hover:border-gray-700/80"
      }`}
    >
      {/* Active Glow Accent */}
      {isActive && (
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-cyan-400 to-emerald-400 rounded-t-2xl" />
      )}

      {/* Top row: Radio + Remark + Actions */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-3">
          {/* Active selection radio */}
          <div className="pt-0.5">
            <div
              className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${
                isActive
                  ? "border-indigo-400 bg-indigo-600"
                  : "border-gray-600 group-hover:border-gray-500"
              }`}
            >
              {isActive && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
            </div>
          </div>

          {/* Title & Host info */}
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white tracking-tight group-hover:text-indigo-300 transition-colors">
                {config.remark || "Unnamed VLESS Server"}
              </h3>
              {isActive && isConnected && (
                <span className="flex items-center gap-1 text-[10px] font-semibold bg-emerald-500/20 text-emerald-400 px-1.5 py-0.2 rounded border border-emerald-500/30 animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  TUNNEL ACTIVE
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-400 font-mono mt-0.5">
              <span>{config.host}</span>
              <span className="text-gray-600">:</span>
              <span className="text-indigo-300">{config.port}</span>
            </div>
          </div>
        </div>

        {/* Quick action buttons */}
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={onPing}
            disabled={isPinging}
            title="Measure TCP latency"
            className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-300 hover:bg-gray-800/80 transition-colors disabled:opacity-50"
          >
            <Activity className={`w-3.5 h-3.5 ${isPinging ? "animate-spin text-indigo-400" : ""}`} />
          </button>
          <button
            onClick={handleCopy}
            title="Copy as vless:// URI"
            className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-300 hover:bg-gray-800/80 transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={onEdit}
            title="Edit configuration"
            className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-300 hover:bg-gray-800/80 transition-colors"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onDelete}
            title="Delete configuration"
            className="p-1.5 rounded-lg text-gray-400 hover:text-rose-400 hover:bg-rose-950/40 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Meta tags / parameters row */}
      <div className="flex flex-wrap items-center gap-1.5 text-[11px] pt-1">
        {/* Security badge */}
        <span
          className={`px-2 py-0.5 rounded-md font-semibold flex items-center gap-1 border ${
            config.security === "reality"
              ? "bg-purple-950/50 text-purple-300 border-purple-800/60"
              : config.security === "tls"
              ? "bg-cyan-950/50 text-cyan-300 border-cyan-800/60"
              : "bg-gray-800 text-gray-400 border-gray-700"
          }`}
        >
          <Lock className="w-2.5 h-2.5" />
          {config.security.toUpperCase()}
          {config.flow ? ` (${config.flow})` : ""}
        </span>

        {/* SNI tag */}
        {config.sni && (
          <span className="px-2 py-0.5 rounded-md bg-gray-800/80 text-gray-300 border border-gray-700/60 font-mono truncate max-w-[180px] flex items-center gap-1">
            <Globe className="w-2.5 h-2.5 text-gray-400 shrink-0" />
            <span className="truncate">{config.sni}</span>
          </span>
        )}

        {/* Fingerprint */}
        {config.fp && (
          <span className="px-1.5 py-0.5 rounded-md bg-gray-800/60 text-gray-400 border border-gray-700/40 text-[10px]">
            fp: {config.fp}
          </span>
        )}

        {/* Allow Insecure badge */}
        {config.allowInsecure && (
          <span className="px-1.5 py-0.5 rounded-md bg-amber-950/40 text-amber-300 border border-amber-800/50 text-[10px]">
            Insecure Decoy
          </span>
        )}

        {/* Latency Pill */}
        <span
          className={`ml-auto px-2 py-0.5 rounded-md text-[11px] font-mono font-medium border flex items-center gap-1 bg-gray-950/40 border-gray-800 ${latencyInfo.color}`}
        >
          <Zap className="w-2.5 h-2.5" />
          {latencyInfo.text}
        </span>
      </div>
    </div>
  );
};
