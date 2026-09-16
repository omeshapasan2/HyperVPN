import React from "react";
import { Shield, ShieldAlert, ShieldCheck, Power, ArrowUp, ArrowDown, Clock, Activity, X } from "lucide-react";
import { VlessConfig, VpnStatus } from "../types/config";
import { formatBytes, formatDuration, formatSpeed } from "../utils/formatters";

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
    <header className="bg-[#111827]/90 backdrop-blur-md border-b border-gray-800/80 px-6 py-4 flex flex-col gap-3 shrink-0 shadow-lg">
      <div className="flex items-center justify-between">
        {/* Left: Brand & Status */}
        <div className="flex items-center gap-3.5">
          <div className="relative">
            <div
              className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-300 shadow-md ${
                isConnected
                  ? "bg-gradient-to-tr from-emerald-600 to-teal-400 text-white shadow-emerald-500/25"
                  : isConnecting
                  ? "bg-gradient-to-tr from-amber-600 to-yellow-400 text-white shadow-amber-500/25 animate-pulse"
                  : "bg-gradient-to-tr from-indigo-600 to-cyan-500 text-white shadow-indigo-500/20"
              }`}
            >
              {isConnected ? (
                <ShieldCheck className="w-6 h-6" />
              ) : isConnecting ? (
                <Activity className="w-6 h-6 animate-spin" />
              ) : (
                <Shield className="w-6 h-6" />
              )}
            </div>
            {/* Status dot */}
            <span
              className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-[#111827] ${
                isConnected
                  ? "bg-emerald-500 animate-pulse-subtle"
                  : isConnecting
                  ? "bg-amber-400"
                  : "bg-gray-500"
              }`}
            />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold tracking-tight text-white flex items-center gap-1.5">
                Hyper<span className="text-indigo-400">VPN</span>
              </h1>
              <span
                className={`text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                  isConnected
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                    : isConnecting
                    ? "bg-amber-500/10 text-amber-300 border-amber-500/30"
                    : "bg-gray-800 text-gray-400 border-gray-700"
                }`}
              >
                {isConnected ? "Connected (TUN)" : isConnecting ? "Connecting..." : "Disconnected"}
              </span>
            </div>
            <p className="text-xs text-gray-400 truncate max-w-xs flex items-center gap-1.5 mt-0.5">
              <span className="text-gray-500">Target:</span>
              {activeConfig ? (
                <span className="text-gray-200 font-medium truncate">
                  {activeConfig.remark} ({activeConfig.host}:{activeConfig.port})
                </span>
              ) : (
                <span className="text-gray-500 italic">No configuration selected</span>
              )}
            </p>
          </div>
        </div>

        {/* Center/Right: Live Metrics when connected */}
        <div className="hidden sm:flex items-center gap-6 text-xs text-gray-300 bg-gray-900/60 px-4 py-2 rounded-xl border border-gray-800/60">
          <div className="flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-indigo-400" />
            <div className="flex flex-col">
              <span className="text-[10px] text-gray-500 uppercase font-semibold">Uptime</span>
              <span className="font-mono font-medium text-gray-200">
                {isConnected ? formatDuration(status.uptimeSeconds) : "--:--:--"}
              </span>
            </div>
          </div>

          <div className="h-6 w-px bg-gray-800" />

          <div className="flex items-center gap-2">
            <ArrowDown className="w-3.5 h-3.5 text-emerald-400" />
            <div className="flex flex-col">
              <span className="text-[10px] text-gray-500 uppercase font-semibold">Down</span>
              <span className="font-mono font-medium text-emerald-300">
                {isConnected ? formatSpeed(status.currentDownloadSpeed) : "0.0 KB/s"}
              </span>
            </div>
          </div>

          <div className="h-6 w-px bg-gray-800" />

          <div className="flex items-center gap-2">
            <ArrowUp className="w-3.5 h-3.5 text-cyan-400" />
            <div className="flex flex-col">
              <span className="text-[10px] text-gray-500 uppercase font-semibold">Up</span>
              <span className="font-mono font-medium text-cyan-300">
                {isConnected ? formatSpeed(status.currentUploadSpeed) : "0.0 KB/s"}
              </span>
            </div>
          </div>

          <div className="h-6 w-px bg-gray-800" />

          <div className="flex items-center gap-2">
            <div className="flex flex-col">
              <span className="text-[10px] text-gray-500 uppercase font-semibold">Session Total</span>
              <span className="font-mono font-medium text-gray-200">
                {isConnected
                  ? formatBytes(status.sessionBytesUplink + status.sessionBytesDownlink)
                  : "0.00 B"}
              </span>
            </div>
          </div>
        </div>

        {/* Right: Connect / Disconnect Action Button */}
        <div className="flex items-center gap-3">
          <button
            onClick={onToggleConnect}
            disabled={isConnecting || (!activeConfig && !isConnected)}
            className={`relative group px-5 py-2.5 rounded-xl font-semibold text-sm transition-all duration-300 flex items-center gap-2 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed ${
              isConnected
                ? "bg-rose-600 hover:bg-rose-500 text-white shadow-rose-900/30 hover:shadow-rose-600/40"
                : isConnecting
                ? "bg-amber-600 text-white shadow-amber-900/30"
                : "bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-900/40 hover:shadow-indigo-600/40 hover:scale-[1.02] active:scale-[0.98]"
            }`}
          >
            <Power
              className={`w-4 h-4 transition-transform duration-300 ${
                isConnecting ? "animate-spin" : isConnected ? "rotate-90" : "group-hover:scale-110"
              }`}
            />
            <span>{isConnected ? "Disconnect" : isConnecting ? "Connecting..." : "Connect"}</span>
          </button>
        </div>
      </div>

      {/* Error Alert Bar if present */}
      {status.error && (
        <div className="bg-rose-950/70 border border-rose-800/80 text-rose-200 px-4 py-2.5 rounded-xl text-xs flex items-center justify-between animate-fadeIn shadow-md">
          <div className="flex items-center gap-2.5">
            <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{status.error}</span>
          </div>
          <button
            onClick={onClearError}
            className="text-rose-400 hover:text-white p-1 rounded-lg hover:bg-rose-900/40 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </header>
  );
};
