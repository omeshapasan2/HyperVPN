import React from "react";
import { useSpeedTest, SpeedTestPhase } from "../hooks/useSpeedTest";
import {
  Zap,
  ArrowDown,
  ArrowUp,
  Activity,
  RotateCcw,
  Square,
  AlertCircle,
  Radio,
} from "lucide-react";

export const SpeedTestTab: React.FC = () => {
  const { state, startTest, stopTest, resetTest } = useSpeedTest();
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

  // Determine which live speed to display on the main meter
  const displaySpeed =
    phase === "download"
      ? currentDownloadSpeed
      : phase === "upload"
      ? currentUploadSpeed
      : phase === "complete"
      ? downloadSpeed ?? 0
      : 0;

  const getPhaseLabel = (p: SpeedTestPhase) => {
    switch (p) {
      case "ping":
        return "Testing Latency & Jitter...";
      case "download":
        return "Testing Download Speed...";
      case "upload":
        return "Testing Upload Speed...";
      case "complete":
        return "Speed Test Finished";
      case "error":
        return "Test Failed";
      default:
        return "Ready for benchmark";
    }
  };

  // SVG Gauge calculations
  const radius = 64;
  const circumference = 2 * Math.PI * radius;
  // Arc is 240 degrees (top open)
  const arcLength = circumference * 0.75;
  const strokeDashoffset = arcLength - (progress / 100) * arcLength;

  return (
    <div className="flex-1 flex flex-col p-3.5 overflow-hidden justify-between">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-300">
            Speed Test
          </h2>
          <p className="text-[10px] text-zinc-500">Benchmark VPN tunnel throughput</p>
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

      {/* Main Meter & Gauge */}
      <div className="flex flex-col items-center justify-center my-auto py-2">
        <div className="relative w-40 h-40 flex items-center justify-center">
          {/* Circular SVG Meter */}
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
            {/* Animated Progress Arc */}
            <circle
              cx="80"
              cy="80"
              r={radius}
              className="stroke-white transition-all duration-300 ease-out"
              strokeWidth="6"
              fill="transparent"
              strokeDasharray={arcLength}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
            />
          </svg>

          {/* Center Readout */}
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            {isRunning || phase === "complete" ? (
              <>
                <span className="text-2xl font-black tracking-tight text-white font-mono">
                  {displaySpeed.toFixed(1)}
                </span>
                <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest -mt-0.5">
                  Mbps
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
        <div className="mt-1 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-900 border border-zinc-800/80 text-[10px] text-zinc-300">
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
          <span>{getPhaseLabel(phase)}</span>
        </div>
      </div>

      {/* Metric Cards Grid (2x2) */}
      <div className="grid grid-cols-2 gap-2 mb-2">
        {/* Ping */}
        <div className="bg-zinc-900/90 border border-zinc-800/90 rounded-xl p-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-zinc-800/80 border border-zinc-700/60 flex items-center justify-center text-zinc-400">
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
        <div className="bg-zinc-900/90 border border-zinc-800/90 rounded-xl p-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-zinc-800/80 border border-zinc-700/60 flex items-center justify-center text-zinc-400">
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
        <div className="bg-zinc-900/90 border border-zinc-800/90 rounded-xl p-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-zinc-800/80 border border-zinc-700/60 flex items-center justify-center text-zinc-400">
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
        <div className="bg-zinc-900/90 border border-zinc-800/90 rounded-xl p-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-zinc-800/80 border border-zinc-700/60 flex items-center justify-center text-zinc-400">
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
            className="w-full py-2.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-700 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all shadow-sm"
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
