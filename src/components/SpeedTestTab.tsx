import React, { useState } from "react";
import { useSpeedTest, SpeedTestPhase } from "../hooks/useSpeedTest";
import { useIpLocation } from "../hooks/useIpLocation";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import {
  Zap,
  ArrowDown,
  ArrowUp,
  Activity,
  RotateCcw,
  Square,
  AlertCircle,
  Radio,
  CheckCircle2,
  Globe,
  MapPin,
  Copy,
  Check,
  RefreshCw,
  Server,
} from "lucide-react";

export const SpeedTestTab: React.FC = () => {
  const { state, startTest, stopTest, resetTest } = useSpeedTest();
  const {
    ip,
    city,
    region,
    country,
    countryCode,
    isp,
    loading: ipLoading,
    refresh: refreshIp,
  } = useIpLocation();

  const [copied, setCopied] = useState(false);

  const {
    phase,
    ping,
    jitter,
    downloadSpeed,
    currentDownloadSpeed,
    uploadSpeed,
    currentUploadSpeed,
    progress,
    errorMessage,
  } = state;

  const isRunning =
    phase === "ping" || phase === "download" || phase === "upload";

  const handleCopyIp = async () => {
    if (!ip) return;
    try {
      if (typeof window !== "undefined" && (window as any).__TAURI_INTERNALS__) {
        await writeText(ip);
      } else {
        await navigator.clipboard.writeText(ip);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Fallback
      navigator.clipboard?.writeText(ip);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  // Determine live metric to display on the central gauge
  let displayValue = "0.0";
  let displayUnit = "Mbps";
  let displaySublabel = "Ready";

  if (phase === "ping") {
    displayValue = ping !== null ? `${ping}` : "—";
    displayUnit = "ms";
    displaySublabel = "Testing Ping";
  } else if (phase === "download") {
    displayValue = currentDownloadSpeed.toFixed(1);
    displayUnit = "Mbps";
    displaySublabel = "Download";
  } else if (phase === "upload") {
    displayValue = currentUploadSpeed.toFixed(1);
    displayUnit = "Mbps";
    displaySublabel = "Upload";
  } else if (phase === "complete") {
    displayValue = (downloadSpeed ?? 0).toFixed(1);
    displayUnit = "Mbps";
    displaySublabel = "Download";
  }

  const getPhaseLabel = (p: SpeedTestPhase) => {
    switch (p) {
      case "ping":
        return "Testing Latency & Jitter...";
      case "download":
        return "Testing Download Speed...";
      case "upload":
        return "Testing Upload Speed...";
      case "complete":
        return "Speed Test Completed";
      case "error":
        return "Test Interrupted / Failed";
      default:
        return "Ready to Benchmark";
    }
  };

  // SVG Gauge calculations
  const radius = 64;
  const circumference = 2 * Math.PI * radius;
  const arcLength = circumference * 0.75;
  const strokeDashoffset = arcLength - (progress / 100) * arcLength;

  // Format location string
  const locationString = [city, region, country || countryCode]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="flex-1 flex flex-col p-3.5 overflow-hidden justify-between">
      {/* Header */}
      <div className="flex items-center justify-between mb-1.5">
        <div>
          <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-300">
            Speed Test
          </h2>
          <p className="text-[10px] text-zinc-500">Multi-stream edge benchmark</p>
        </div>
        {phase === "complete" && (
          <button
            onClick={resetTest}
            className="p-1.5 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-lg text-xs transition-colors"
            title="Reset"
          >
            <RotateCcw className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* IP & Location Display Card */}
      <div className="relative bg-zinc-900/80 border border-zinc-800/80 rounded-xl p-2.5 backdrop-blur-md transition-all shadow-sm">
        <div className="grid grid-cols-2 gap-2">
          {/* IP Address Section */}
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-zinc-800/90 border border-zinc-700/60 flex items-center justify-center text-zinc-400 shrink-0">
              <Globe className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[9px] text-zinc-500 uppercase font-semibold tracking-wider flex items-center gap-1">
                Your IP
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-xs font-bold text-zinc-100 font-mono truncate">
                  {ipLoading && !ip ? (
                    <span className="text-zinc-600 animate-pulse">Detecting...</span>
                  ) : (
                    ip || "Unavailable"
                  )}
                </span>
                {ip && (
                  <button
                    onClick={handleCopyIp}
                    className="text-zinc-500 hover:text-zinc-200 transition-colors shrink-0"
                    title={copied ? "Copied!" : "Copy IP"}
                  >
                    {copied ? (
                      <Check className="w-3 h-3 text-emerald-400" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Location & ISP Section */}
          <div className="flex items-center justify-between gap-1.5 min-w-0 pl-2 border-l border-zinc-800/80">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <div className="w-7 h-7 rounded-lg bg-zinc-800/90 border border-zinc-700/60 flex items-center justify-center text-zinc-400 shrink-0">
                <MapPin className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[9px] text-zinc-500 uppercase font-semibold tracking-wider flex items-center gap-1">
                  Location
                </div>
                <div className="text-xs font-bold text-zinc-200 truncate mt-0.5" title={locationString}>
                  {ipLoading && !locationString ? (
                    <span className="text-zinc-600 animate-pulse">Locating...</span>
                  ) : (
                    locationString || "Unknown"
                  )}
                </div>
                {isp && (
                  <div className="text-[9px] text-zinc-500 truncate flex items-center gap-1">
                    <Server className="w-2.5 h-2.5 shrink-0 opacity-70" />
                    <span className="truncate">{isp}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Refresh Button */}
            <button
              onClick={refreshIp}
              disabled={ipLoading}
              className={`p-1.5 rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition-colors shrink-0 ${
                ipLoading ? "opacity-50 cursor-not-allowed" : ""
              }`}
              title="Refresh IP & Location"
            >
              <RefreshCw className={`w-3 h-3 ${ipLoading ? "animate-spin text-zinc-400" : ""}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Main Circular Gauge & Central Readout */}
      <div className="flex flex-col items-center justify-center my-auto py-1">
        <div className="relative w-36 h-36 flex items-center justify-center">
          {/* Circular SVG Progress Arc */}
          <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 160 160">
            {/* Background Arc */}
            <circle
              cx="80"
              cy="80"
              r={radius}
              className="stroke-zinc-800/80"
              strokeWidth="6"
              fill="transparent"
              strokeDasharray={arcLength}
              strokeDashoffset={0}
              strokeLinecap="round"
            />
            {/* Active Progress Indicator */}
            <circle
              cx="80"
              cy="80"
              r={radius}
              className="stroke-white transition-all duration-200 ease-out"
              strokeWidth="6"
              fill="transparent"
              strokeDasharray={arcLength}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
            />
          </svg>

          {/* Central Live HUD */}
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center select-none">
            {isRunning || phase === "complete" ? (
              <>
                {/* Direction Icon Badge */}
                <div className="flex items-center gap-1 mb-0.5">
                  {phase === "ping" && <Activity className="w-3.5 h-3.5 text-zinc-400 animate-pulse" />}
                  {phase === "download" && <ArrowDown className="w-3.5 h-3.5 text-white animate-bounce" />}
                  {phase === "upload" && <ArrowUp className="w-3.5 h-3.5 text-white animate-bounce" />}
                  {phase === "complete" && <CheckCircle2 className="w-3.5 h-3.5 text-zinc-300" />}
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                    {displaySublabel}
                  </span>
                </div>

                {/* Live Numerical Readout */}
                <span className="text-2xl font-black tracking-tight text-white font-mono leading-none">
                  {displayValue}
                </span>

                <span className="text-[9px] font-semibold text-zinc-500 uppercase tracking-widest mt-1">
                  {displayUnit}
                </span>
              </>
            ) : (
              <div className="flex flex-col items-center">
                <Zap className="w-7 h-7 text-zinc-600 mb-1" />
                <span className="text-[11px] font-medium text-zinc-500">
                  Ready
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Phase Status Pill */}
        <div className="mt-1 flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-zinc-900 border border-zinc-800/80 text-[10px] text-zinc-300 shadow-sm">
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              isRunning
                ? "bg-white animate-pulse"
                : phase === "complete"
                ? "bg-zinc-300"
                : phase === "error"
                ? "bg-zinc-600"
                : "bg-zinc-700"
            }`}
          />
          <span className="font-medium">{getPhaseLabel(phase)}</span>
        </div>
      </div>

      {/* 2x2 Metric Cards Grid */}
      <div className="grid grid-cols-2 gap-2 mb-2">
        {/* Ping */}
        <div
          className={`border rounded-xl p-2.5 flex items-center justify-between transition-colors ${
            phase === "ping"
              ? "bg-zinc-800/80 border-zinc-600"
              : "bg-zinc-900/90 border-zinc-800/90"
          }`}
        >
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-zinc-800 border border-zinc-700/60 flex items-center justify-center text-zinc-400">
              <Activity className="w-3.5 h-3.5" />
            </div>
            <div>
              <div className="text-[9px] text-zinc-500 uppercase font-semibold">Ping</div>
              <div className="text-xs font-bold text-zinc-200 font-mono">
                {ping !== null ? `${ping} ms` : "—"}
              </div>
            </div>
          </div>
        </div>

        {/* Jitter */}
        <div
          className={`border rounded-xl p-2.5 flex items-center justify-between transition-colors ${
            phase === "ping"
              ? "bg-zinc-800/80 border-zinc-600"
              : "bg-zinc-900/90 border-zinc-800/90"
          }`}
        >
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-zinc-800 border border-zinc-700/60 flex items-center justify-center text-zinc-400">
              <Radio className="w-3.5 h-3.5" />
            </div>
            <div>
              <div className="text-[9px] text-zinc-500 uppercase font-semibold">Jitter</div>
              <div className="text-xs font-bold text-zinc-200 font-mono">
                {jitter !== null ? `±${jitter} ms` : "—"}
              </div>
            </div>
          </div>
        </div>

        {/* Download */}
        <div
          className={`border rounded-xl p-2.5 flex items-center justify-between transition-colors ${
            phase === "download"
              ? "bg-zinc-800/80 border-zinc-600"
              : "bg-zinc-900/90 border-zinc-800/90"
          }`}
        >
          <div className="flex items-center gap-2">
            <div
              className={`w-6 h-6 rounded-lg border flex items-center justify-center ${
                phase === "download"
                  ? "bg-white text-zinc-950 border-white"
                  : "bg-zinc-800 border-zinc-700/60 text-zinc-400"
              }`}
            >
              <ArrowDown className="w-3.5 h-3.5" />
            </div>
            <div>
              <div className="text-[9px] text-zinc-500 uppercase font-semibold">Download</div>
              <div className="text-xs font-bold text-zinc-200 font-mono">
                {downloadSpeed !== null
                  ? `${downloadSpeed.toFixed(1)} Mbps`
                  : phase === "download"
                  ? `${currentDownloadSpeed.toFixed(1)} Mbps`
                  : "—"}
              </div>
            </div>
          </div>
        </div>

        {/* Upload */}
        <div
          className={`border rounded-xl p-2.5 flex items-center justify-between transition-colors ${
            phase === "upload"
              ? "bg-zinc-800/80 border-zinc-600"
              : "bg-zinc-900/90 border-zinc-800/90"
          }`}
        >
          <div className="flex items-center gap-2">
            <div
              className={`w-6 h-6 rounded-lg border flex items-center justify-center ${
                phase === "upload"
                  ? "bg-white text-zinc-950 border-white"
                  : "bg-zinc-800 border-zinc-700/60 text-zinc-400"
              }`}
            >
              <ArrowUp className="w-3.5 h-3.5" />
            </div>
            <div>
              <div className="text-[9px] text-zinc-500 uppercase font-semibold">Upload</div>
              <div className="text-xs font-bold text-zinc-200 font-mono">
                {uploadSpeed !== null
                  ? `${uploadSpeed.toFixed(1)} Mbps`
                  : phase === "upload"
                  ? `${currentUploadSpeed.toFixed(1)} Mbps`
                  : "—"}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Error Banner if any */}
      {errorMessage && (
        <div className="mb-2 p-2 bg-zinc-900 border border-zinc-800 rounded-lg flex items-center gap-2 text-[10px] text-zinc-400">
          <AlertCircle className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
          <span className="truncate">{errorMessage}</span>
        </div>
      )}

      {/* Action Button */}
      <div>
        {isRunning ? (
          <button
            onClick={stopTest}
            className="w-full py-2.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-700 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all shadow-sm active:scale-[0.99]"
          >
            <Square className="w-3.5 h-3.5 fill-current" />
            Stop Speed Test
          </button>
        ) : (
          <button
            onClick={startTest}
            className="w-full py-2.5 bg-white hover:bg-zinc-200 text-zinc-950 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-md active:scale-[0.99]"
          >
            <Zap className="w-3.5 h-3.5 fill-current" />
            {phase === "complete" ? "Test Again" : "Start Speed Test"}
          </button>
        )}
      </div>
    </div>
  );
};
