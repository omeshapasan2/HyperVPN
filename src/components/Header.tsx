import React, { useState, useEffect, useRef } from "react";
import {
  Power,
  ArrowUp,
  ArrowDown,
  Clock,
  Activity,
  X,
  Shield,
  ShieldCheck,
  AlertCircle,
  Server,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
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

  // Track state transitions for the liquid wave propagation
  const prevConnectedRef = useRef(isConnected);
  const [waveState, setWaveState] = useState<{
    active: boolean;
    direction: "forward" | "reverse";
    id: number;
  }>({
    active: false,
    direction: "forward",
    id: 0,
  });

  useEffect(() => {
    if (prevConnectedRef.current !== isConnected) {
      const direction = isConnected ? "forward" : "reverse";
      setWaveState({
        active: true,
        direction,
        id: Date.now(),
      });
      prevConnectedRef.current = isConnected;

      const timer = setTimeout(() => {
        setWaveState((prev) => ({ ...prev, active: false }));
      }, 1350);

      return () => clearTimeout(timer);
    }
  }, [isConnected]);

  // Status label
  const statusLabel = isConnected
    ? "CONNECTED (TUN)"
    : isConnecting
    ? "CONNECTING..."
    : "READY";

  return (
    <motion.header
      // The header height is strictly fixed at 88px and NEVER resizes or expands
      className="relative w-full h-[88px] min-h-[88px] max-h-[88px] px-4 py-2.5 flex flex-col justify-between bg-zinc-950/80 backdrop-blur-2xl border-b border-white/[0.08] select-none shrink-0 overflow-hidden"
      style={{
        backgroundImage:
          "radial-gradient(ellipse 75% 120% at 50% -20%, rgba(255, 255, 255, 0.05), transparent 70%), radial-gradient(ellipse 60% 80% at 50% 120%, rgba(0, 0, 0, 0.4), transparent 80%)",
      }}
      // Subtle Apple-like glass surface deformation as wave passes through
      animate={{
        scaleX: waveState.active ? [1, 1.003, 0.998, 1] : 1,
        scaleY: waveState.active ? [1, 0.997, 1.002, 1] : 1,
      }}
      transition={{
        duration: 1.2,
        ease: [0.16, 1, 0.3, 1], // Apple spring curve
      }}
    >
      {/* ──────────────────────────────────────────────────────────────────
          LIQUID GLASS WAVE PROPAGATION
          A thin, elegant wave originates around the connection control
          and travels horizontally across the entire card.
          ────────────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {waveState.active && (
          <motion.div
            key={waveState.id}
            className="absolute inset-0 pointer-events-none z-10 overflow-hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            {/* 1. Specular Liquid Caustic Wave Front (Gliding across glass) */}
            <motion.div
              className="absolute top-0 bottom-0 w-48 sm:w-64 -skew-x-12"
              initial={{
                x: waveState.direction === "forward" ? "120%" : "-40%",
                opacity: 0,
              }}
              animate={{
                x: waveState.direction === "forward" ? "-50%" : "130%",
                opacity: [0, 0.9, 1, 0.75, 0],
              }}
              transition={{
                duration: 1.15,
                ease: [0.16, 1, 0.3, 1],
              }}
              style={{
                background:
                  waveState.direction === "forward"
                    ? "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.01) 15%, rgba(255,255,255,0.07) 35%, rgba(255,255,255,0.18) 50%, rgba(255,255,255,0.05) 68%, transparent 100%)"
                    : "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.02) 20%, rgba(255,255,255,0.13) 50%, rgba(255,255,255,0.02) 75%, transparent 100%)",
              }}
            />

            {/* 2. Liquid Surface Ribbon (Subtle wave curvature contour) */}
            <motion.svg
              className="absolute inset-0 w-full h-full"
              preserveAspectRatio="none"
              viewBox="0 0 800 88"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 0.85, 0.95, 0.6, 0] }}
              transition={{ duration: 1.15, ease: [0.16, 1, 0.3, 1] }}
            >
              <defs>
                <linearGradient
                  id="waveGradient"
                  x1={waveState.direction === "forward" ? "100%" : "0%"}
                  y1="0%"
                  x2={waveState.direction === "forward" ? "0%" : "100%"}
                  y2="0%"
                >
                  <stop offset="0%" stopColor="rgba(255,255,255,0)" />
                  <stop offset="35%" stopColor="rgba(255,255,255,0.03)" />
                  <stop offset="50%" stopColor="rgba(255,255,255,0.18)" />
                  <stop offset="65%" stopColor="rgba(255,255,255,0.03)" />
                  <stop offset="100%" stopColor="rgba(255,255,255,0)" />
                </linearGradient>
              </defs>
              <motion.path
                d="M0,44 Q200,36 400,48 T800,44"
                fill="none"
                stroke="url(#waveGradient)"
                strokeWidth="2"
                initial={{
                  pathLength: 0.2,
                  pathOffset: waveState.direction === "forward" ? 0.9 : 0,
                }}
                animate={{
                  pathLength: [0.2, 0.4, 0.3, 0.1],
                  pathOffset: waveState.direction === "forward" ? [0.9, 0] : [0, 0.9],
                }}
                transition={{
                  duration: 1.15,
                  ease: [0.16, 1, 0.3, 1],
                }}
              />
            </motion.svg>

            {/* 3. Top Edge Liquid Meniscus Shimmer */}
            <motion.div
              className="absolute inset-x-0 top-0 h-[1.5px]"
              initial={{
                backgroundPosition:
                  waveState.direction === "forward" ? "100% 0%" : "0% 0%",
                opacity: 0,
              }}
              animate={{
                backgroundPosition:
                  waveState.direction === "forward" ? "0% 0%" : "100% 0%",
                opacity: [0, 0.9, 1, 0],
              }}
              transition={{
                duration: 1.2,
                ease: [0.22, 1, 0.36, 1],
              }}
              style={{
                background:
                  "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.55) 50%, transparent 100%)",
                backgroundSize: "35% 100%",
                backgroundRepeat: "no-repeat",
              }}
            />

            {/* 4. Soft Physical Pulse Ring radiating from the button */}
            <motion.div
              className="absolute right-6 top-5 w-10 h-10 -translate-y-1/2 rounded-full border border-white/20"
              initial={{ scale: 0.3, opacity: 0.9 }}
              animate={{ scale: 4.2, opacity: 0 }}
              transition={{
                duration: 0.95,
                ease: "easeOut",
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ──────────────────────────────────────────────────────────────────
          ROW 1: Server Status & Action Button
          ────────────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 z-20">
        {/* Left: Status Icon, Status Label, and Server Remark */}
        <motion.div
          className="flex items-center gap-2.5 min-w-0 flex-1"
          animate={{
            x: waveState.active
              ? waveState.direction === "forward"
                ? [0, -2, 1, 0]
                : [0, 2, -1, 0]
              : 0,
            scale: waveState.active ? [1, 1.02, 0.99, 1] : 1,
          }}
          transition={{
            duration: 0.95,
            delay: waveState.direction === "forward" ? 0.3 : 0.1,
            ease: [0.16, 1, 0.3, 1],
          }}
        >
          {/* Dynamic Status Capsule */}
          <motion.div
            layout
            className={`relative p-1.5 rounded-lg flex items-center justify-center shrink-0 border transition-all duration-500 ${
              isConnected
                ? "bg-white/[0.08] border-white/20 shadow-[0_0_12px_rgba(255,255,255,0.08)]"
                : isConnecting
                ? "bg-zinc-800/80 border-zinc-700/80"
                : "bg-zinc-900/90 border-white/[0.06]"
            }`}
            whileHover={{ scale: 1.04 }}
            transition={{ type: "spring", stiffness: 380, damping: 24 }}
          >
            <AnimatePresence mode="wait">
              {isConnected ? (
                <motion.div
                  key="shield-check"
                  initial={{ scale: 0.5, rotate: -12, opacity: 0 }}
                  animate={{ scale: 1, rotate: 0, opacity: 1 }}
                  exit={{ scale: 0.5, rotate: 12, opacity: 0 }}
                  transition={{
                    type: "spring",
                    stiffness: 420,
                    damping: 20,
                    mass: 0.7,
                  }}
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-white drop-shadow-[0_0_6px_rgba(255,255,255,0.6)]" />
                </motion.div>
              ) : isConnecting ? (
                <motion.div
                  key="activity"
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1, rotate: 360 }}
                  exit={{ scale: 0.6, opacity: 0 }}
                  transition={{
                    rotate: { repeat: Infinity, duration: 1.2, ease: "linear" },
                    scale: { duration: 0.2 },
                    opacity: { duration: 0.2 },
                  }}
                >
                  <Activity className="w-3.5 h-3.5 text-zinc-300" />
                </motion.div>
              ) : (
                <motion.div
                  key="shield"
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.6, opacity: 0 }}
                  transition={{
                    type: "spring",
                    stiffness: 400,
                    damping: 24,
                    mass: 0.7,
                  }}
                >
                  <Shield className="w-3.5 h-3.5 text-zinc-400" />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Micro Status Breathing Dot */}
            <motion.span
              className={`absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full ring-2 ring-zinc-950 ${
                isConnected
                  ? "bg-white shadow-[0_0_6px_rgba(255,255,255,0.9)]"
                  : isConnecting
                  ? "bg-amber-400 animate-pulse shadow-[0_0_4px_rgba(251,191,36,0.6)]"
                  : "bg-zinc-500"
              }`}
              animate={
                isConnected
                  ? { scale: [1, 1.2, 1], opacity: [0.85, 1, 0.85] }
                  : {}
              }
              transition={{
                repeat: Infinity,
                duration: 2.8,
                ease: "easeInOut",
              }}
            />
          </motion.div>

          {/* Status Label & Server Title */}
          <div className="flex flex-col min-w-0 justify-center">
            <div className="h-3.5 flex items-center overflow-hidden">
              <AnimatePresence mode="wait">
                <motion.span
                  key={statusLabel}
                  initial={{ y: 6, opacity: 0, filter: "blur(2px)" }}
                  animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
                  exit={{ y: -6, opacity: 0, filter: "blur(2px)" }}
                  transition={{
                    type: "spring",
                    stiffness: 380,
                    damping: 26,
                  }}
                  className={`text-[11px] font-bold uppercase tracking-wider ${
                    isConnected
                      ? "text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]"
                      : isConnecting
                      ? "text-zinc-300"
                      : "text-zinc-400"
                  }`}
                >
                  {statusLabel}
                </motion.span>
              </AnimatePresence>
            </div>

            <p className="text-xs text-zinc-300 font-medium truncate mt-0.5">
              {activeConfig ? (
                <span className="text-zinc-200">{activeConfig.remark}</span>
              ) : (
                <span className="text-zinc-500 italic text-[11px]">
                  No server selected
                </span>
              )}
            </p>
          </div>
        </motion.div>

        {/* Right: Main Focal Action Button */}
        <motion.div
          className="flex items-center shrink-0 z-20"
          whileTap={{ scale: 0.94 }}
          transition={{ type: "spring", stiffness: 450, damping: 25 }}
        >
          <motion.button
            onClick={onToggleConnect}
            disabled={isConnecting || (!activeConfig && !isConnected)}
            className={`relative px-4 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 shrink-0 transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer ${
              isConnected
                ? "bg-white hover:bg-zinc-100 text-zinc-950 font-bold shadow-[0_0_20px_rgba(255,255,255,0.22)] border border-white"
                : isConnecting
                ? "bg-zinc-800 text-zinc-300 border border-white/10 animate-pulse"
                : "bg-zinc-800/90 hover:bg-zinc-700/90 text-zinc-100 border border-white/[0.12] hover:border-white/20 shadow-sm"
            }`}
            animate={{
              scale: waveState.active ? [1, 1.03, 0.98, 1] : 1,
            }}
            transition={{
              duration: 0.85,
              ease: [0.16, 1, 0.3, 1],
            }}
          >
            <motion.div
              animate={{
                rotate: isConnecting ? 360 : isConnected ? 0 : 0,
              }}
              transition={
                isConnecting
                  ? { repeat: Infinity, duration: 1.2, ease: "linear" }
                  : { type: "spring", stiffness: 350, damping: 20 }
              }
            >
              <Power
                className={`w-3.5 h-3.5 ${
                  isConnected ? "text-zinc-950 stroke-[2.5]" : "text-current"
                }`}
              />
            </motion.div>

            <AnimatePresence mode="wait">
              <motion.span
                key={isConnected ? "disconnect" : isConnecting ? "connecting" : "connect"}
                initial={{ y: 5, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -5, opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                {isConnected ? "Disconnect" : isConnecting ? "Connecting" : "Connect"}
              </motion.span>
            </AnimatePresence>
          </motion.button>
        </motion.div>
      </div>

      {/* ──────────────────────────────────────────────────────────────────
          ROW 2: Live Metrics Bar (When Connected) OR Idle Server Info (When Disconnected)
          Continuous morph within the exact same fixed height slot!
          ────────────────────────────────────────────────────────────────── */}
      <div className="h-7 w-full flex items-center justify-between z-20 overflow-hidden">
        <AnimatePresence mode="wait">
          {isConnected ? (
            /* Connected Live Metrics Bar: Download + Upload + Connected Time (Uptime) */
            <motion.div
              key="metrics-connected"
              initial={{
                opacity: 0,
                scale: 0.95,
                y: 4,
                filter: "blur(3px)",
              }}
              animate={{
                opacity: 1,
                scale: 1,
                y: 0,
                filter: "blur(0px)",
              }}
              exit={{
                opacity: 0,
                scale: 0.95,
                y: -4,
                filter: "blur(3px)",
              }}
              transition={{
                type: "spring",
                stiffness: 340,
                damping: 24,
                delay: 0.12, // Synchronized with liquid wave front arrival
              }}
              className="w-full h-full flex items-center justify-between text-[11px] font-mono bg-zinc-900/80 border border-white/[0.08] px-3 rounded-lg text-zinc-300 shadow-inner backdrop-blur-md"
            >
              {/* 1. Download Speed */}
              <div className="flex items-center gap-1.5 min-w-0">
                <ArrowDown className="w-3 h-3 text-zinc-400 shrink-0" />
                <span className="font-semibold text-zinc-200 tracking-tight tabular-nums">
                  {formatSpeed(status.currentDownloadSpeed)}
                </span>
              </div>

              <div className="h-3 w-px bg-white/10 shrink-0" />

              {/* 2. Upload Speed */}
              <div className="flex items-center gap-1.5 min-w-0">
                <ArrowUp className="w-3 h-3 text-zinc-400 shrink-0" />
                <span className="font-semibold text-zinc-200 tracking-tight tabular-nums">
                  {formatSpeed(status.currentUploadSpeed)}
                </span>
              </div>

              <div className="h-3 w-px bg-white/10 shrink-0" />

              {/* 3. Connected Time / Uptime */}
              <div className="flex items-center gap-1.5 min-w-0 text-zinc-300">
                <Clock className="w-3 h-3 text-zinc-400 shrink-0" />
                <span className="font-medium text-zinc-200 tracking-tight tabular-nums">
                  {formatDuration(status.uptimeSeconds)}
                </span>
              </div>
            </motion.div>
          ) : (
            /* Disconnected / Ready Info Bar: Server Host / Protocol */
            <motion.div
              key="info-ready"
              initial={{
                opacity: 0,
                scale: 0.95,
                y: -4,
                filter: "blur(3px)",
              }}
              animate={{
                opacity: 1,
                scale: 1,
                y: 0,
                filter: "blur(0px)",
              }}
              exit={{
                opacity: 0,
                scale: 0.95,
                y: 4,
                filter: "blur(3px)",
              }}
              transition={{
                type: "spring",
                stiffness: 340,
                damping: 24,
                delay: 0.12,
              }}
              className="w-full h-full flex items-center justify-between text-[11px] font-mono bg-zinc-900/40 border border-white/[0.04] px-3 rounded-lg text-zinc-400"
            >
              <div className="flex items-center gap-1.5 truncate">
                <Server className="w-3 h-3 text-zinc-500 shrink-0" />
                <span className="truncate text-zinc-400">
                  {activeConfig
                    ? `${activeConfig.host}:${activeConfig.port}`
                    : "No server configured"}
                </span>
              </div>

              {activeConfig && (
                <div className="flex items-center gap-1.5 text-zinc-500 uppercase text-[10px] shrink-0 font-sans font-semibold">
                  <span className="px-1.5 py-0.5 rounded bg-white/[0.04] border border-white/[0.06] text-zinc-400">
                    {activeConfig.network}
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-white/[0.04] border border-white/[0.06] text-zinc-400">
                    {activeConfig.security}
                  </span>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ──────────────────────────────────────────────────────────────────
          FLOATING ERROR TOAST OVERLAY
          Guarantees the card height NEVER expands or shifts even on errors!
          ────────────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {status.error && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 420, damping: 28 }}
            className="absolute inset-x-3 top-2 bottom-2 z-30 bg-zinc-900/95 border border-red-500/40 text-zinc-200 px-3.5 rounded-xl text-xs flex items-center justify-between shadow-2xl backdrop-blur-2xl"
          >
            <div className="flex items-center gap-2 min-w-0">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span className="truncate font-medium">{status.error}</span>
            </div>
            <button
              onClick={onClearError}
              className="text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-zinc-800 shrink-0 ml-2 transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
};
