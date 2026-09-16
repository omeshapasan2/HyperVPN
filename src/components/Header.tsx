import React from "react";
import { Power, ArrowUp, ArrowDown, Clock, Activity, X, Shield, ShieldCheck, AlertCircle } from "lucide-react";
import { VlessConfig, VpnStatus } from "../types/config";
import { formatDuration, formatSpeed } from "../utils/formatters";

interface HeaderProps {
  status: VpnStatus;
  activeConfig: VlessConfig | null;
  onToggleConnect: () => void;
  onClearError: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  status,
  activeConfig,
  onToggleConnect,
  onClearError,
}) => {
  const isConnected = status.connected;
  const isConnecting = status.connecting;

  return (
    <header className="bg-zinc-950/70 border-b border-zinc-800/80 px-4 py-3 flex flex-col gap-2.5 shrink-0 select-none">
      {/* Top Row: Server summary & Connect button */}
      <div className="flex items-center justify-between gap-3">
        {/* Left: Server and Status */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            {isConnected ? (
              <ShieldCheck className="w-3.5 h-3.5 text-white shrink-0" />
            ) : isConnecting ? (
              <Activity className="w-3.5 h-3.5 text-zinc-400 animate-spin shrink-0" />
            ) : (
              <Shield className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
            )}
            <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-300">
              {isConnected ? "Connected (TUN)" : isConnecting ? "Connecting..." : "Ready"}
            </span>
          </div>

          <p className="text-xs text-zinc-400 truncate">
            {activeConfig ? (
              <span className="text-zinc-200 font-medium">{activeConfig.remark}</span>
            ) : (
              <span className="text-zinc-600 italic">No server selected</span>
            )}
          </p>
        </div>

        {/* Right: Main Focal Action Button */}
        <button
          onClick={onToggleConnect}
          disabled={isConnecting || (!activeConfig && !isConnected)}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all duration-150 flex items-center gap-1.5 shrink-0 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed ${
            isConnected
              ? "bg-white hover:bg-zinc-200 text-black shadow-zinc-900/50 active:scale-95"
              : isConnecting
              ? "bg-zinc-800 text-zinc-300 border border-zinc-700 animate-pulse"
              : "bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700 active:scale-95"
          }`}
        >
          <Power className={`w-3.5 h-3.5 ${isConnecting ? "animate-spin" : ""}`} />
          <span>{isConnected ? "Disconnect" : isConnecting ? "Connecting" : "Connect"}</span>
        </button>
      </div>

      {/* Connected Live Metrics Bar */}
      {isConnected && (
        <div className="flex items-center justify-between text-[11px] font-mono bg-zinc-900/90 border border-zinc-800 px-3 py-1.5 rounded-lg text-zinc-300 animate-fadeIn">
          <div className="flex items-center gap-1">
            <ArrowDown className="w-3 h-3 text-zinc-400" />
            <span>{formatSpeed(status.currentDownloadSpeed)}</span>
          </div>

          <div className="h-3 w-px bg-zinc-800" />

          <div className="flex items-center gap-1">
            <ArrowUp className="w-3 h-3 text-zinc-400" />
            <span>{formatSpeed(status.currentUploadSpeed)}</span>
          </div>

          <div className="h-3 w-px bg-zinc-800" />

          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3 text-zinc-500" />
            <span>{formatDuration(status.uptimeSeconds)}</span>
          </div>
        </div>
      )}

      {/* Error Bar */}
      {status.error && (
        <div className="bg-zinc-900 border border-zinc-700 text-zinc-200 px-3 py-2 rounded-xl text-xs flex items-center justify-between animate-fadeIn shadow-sm">
          <div className="flex items-center gap-2 min-w-0">
            <AlertCircle className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
            <span className="truncate">{status.error}</span>
          </div>
          <button
            onClick={onClearError}
            className="text-zinc-400 hover:text-white p-0.5 rounded hover:bg-zinc-800 shrink-0 ml-2"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </header>
  );
};
