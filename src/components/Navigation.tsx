import React, { useState, useRef, useEffect, useCallback } from "react";
import { Server, BarChart3, Gauge, ShieldCheck, Sliders, Terminal } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export type TabType = "configs" | "usage" | "speed" | "verify" | "settings" | "logs";

interface NavigationProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}

export const Navigation: React.FC<NavigationProps> = ({ activeTab, onTabChange }) => {
  const tabs = [
    { id: "configs" as TabType, label: "Servers", icon: Server },
    { id: "usage" as TabType, label: "Usage", icon: BarChart3 },
    { id: "speed" as TabType, label: "Speed", icon: Gauge },
    { id: "verify" as TabType, label: "Verify", icon: ShieldCheck },
    { id: "settings" as TabType, label: "Settings", icon: Sliders },
    { id: "logs" as TabType, label: "Logs", icon: Terminal },
  ];

  // Track tab index to determine vertical wave propagation direction (down vs up)
  const prevTabRef = useRef<TabType>(activeTab);
  const [waveState, setWaveState] = useState<{
    active: boolean;
    direction: "down" | "up";
    id: number;
  }>({
    active: false,
    direction: "down",
    id: 0,
  });

  useEffect(() => {
    if (prevTabRef.current !== activeTab) {
      const prevIdx = tabs.findIndex((t) => t.id === prevTabRef.current);
      const currIdx = tabs.findIndex((t) => t.id === activeTab);
      const direction = currIdx >= prevIdx ? "down" : "up";

      setWaveState({
        active: true,
        direction,
        id: Date.now(),
      });

      prevTabRef.current = activeTab;

      const timer = setTimeout(() => {
        setWaveState((prev) => ({ ...prev, active: false }));
      }, 1100);

      return () => clearTimeout(timer);
    }
  }, [activeTab]);

  // Handle wheel scrolling over the sidebar to switch tabs
  const lastWheelTimeRef = useRef<number>(0);

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      const now = Date.now();
      // Cooldown to ensure 1 scroll step = 1 tab switch (filtering momentum scroll)
      if (now - lastWheelTimeRef.current < 200) {
        return;
      }

      const currentIdx = tabs.findIndex((t) => t.id === activeTab);
      if (currentIdx === -1) return;

      if (e.deltaY > 0) {
        // Scroll Down -> Next Tab
        if (currentIdx < tabs.length - 1) {
          lastWheelTimeRef.current = now;
          onTabChange(tabs[currentIdx + 1].id);
        }
      } else if (e.deltaY < 0) {
        // Scroll Up -> Previous Tab
        if (currentIdx > 0) {
          lastWheelTimeRef.current = now;
          onTabChange(tabs[currentIdx - 1].id);
        }
      }
    },
    [activeTab, onTabChange, tabs]
  );

  return (
    <motion.nav
      onWheel={handleWheel}
      className="relative w-14 bg-zinc-950/80 backdrop-blur-2xl border-r border-white/[0.08] flex flex-col items-center py-3 gap-2 shrink-0 select-none z-20 overflow-hidden cursor-default"
      style={{
        backgroundImage:
          "radial-gradient(ellipse 120% 70% at -20% 50%, rgba(255, 255, 255, 0.04), transparent 70%), radial-gradient(ellipse 80% 60% at 120% 50%, rgba(0, 0, 0, 0.4), transparent 80%)",
      }}
      animate={{
        scaleY: waveState.active ? [1, 1.004, 0.997, 1] : 1,
      }}
      transition={{
        duration: 0.9,
        ease: [0.16, 1, 0.3, 1],
      }}
    >
      {/* ──────────────────────────────────────────────────────────────────
          VERTICAL LIQUID GLASS WAVE PROPAGATION
          Specular caustic light travelling vertically along the navigation rail
          ────────────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {waveState.active && (
          <motion.div
            key={waveState.id}
            className="absolute inset-0 pointer-events-none z-10 overflow-hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {/* 1. Specular Liquid Caustic Wave Front (Gliding vertically) */}
            <motion.div
              className="absolute left-0 right-0 h-28 -skew-y-12"
              initial={{
                y: waveState.direction === "down" ? "-30%" : "120%",
                opacity: 0,
              }}
              animate={{
                y: waveState.direction === "down" ? "120%" : "-30%",
                opacity: [0, 0.85, 1, 0.7, 0],
              }}
              transition={{
                duration: 0.95,
                ease: [0.16, 1, 0.3, 1],
              }}
              style={{
                background:
                  waveState.direction === "down"
                    ? "linear-gradient(180deg, transparent 0%, rgba(255,255,255,0.01) 15%, rgba(255,255,255,0.08) 35%, rgba(255,255,255,0.18) 50%, rgba(255,255,255,0.05) 68%, transparent 100%)"
                    : "linear-gradient(180deg, transparent 0%, rgba(255,255,255,0.02) 20%, rgba(255,255,255,0.14) 50%, rgba(255,255,255,0.02) 75%, transparent 100%)",
              }}
            />

            {/* 2. Right Edge Liquid Meniscus Shimmer */}
            <motion.div
              className="absolute top-0 bottom-0 right-0 w-[1.5px]"
              initial={{
                backgroundPosition:
                  waveState.direction === "down" ? "0% 0%" : "0% 100%",
                opacity: 0,
              }}
              animate={{
                backgroundPosition:
                  waveState.direction === "down" ? "0% 100%" : "0% 0%",
                opacity: [0, 0.9, 1, 0],
              }}
              transition={{
                duration: 1.0,
                ease: [0.22, 1, 0.36, 1],
              }}
              style={{
                background:
                  "linear-gradient(180deg, transparent 0%, rgba(255,255,255,0.6) 50%, transparent 100%)",
                backgroundSize: "100% 35%",
                backgroundRepeat: "no-repeat",
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Brand Icon / Logo */}
      <motion.div
        className="w-9 h-9 rounded-xl bg-zinc-900/90 border border-white/[0.08] flex items-center justify-center text-zinc-100 mb-2 shadow-sm overflow-hidden p-1 relative group cursor-pointer"
        whileHover={{ scale: 1.08, rotate: [0, -3, 3, 0] }}
        whileTap={{ scale: 0.92 }}
        transition={{ type: "spring", stiffness: 420, damping: 22 }}
      >
        <img
          src="/icons/hyper.png"
          alt="HyperVPN"
          className="w-full h-full object-contain rounded-lg drop-shadow-sm"
        />
        <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-xl pointer-events-none" />
      </motion.div>

      {/* Nav items */}
      <div className="flex-1 flex flex-col items-center gap-1.5 w-full px-1.5 z-20">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <motion.button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              title={tab.label}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.9 }}
              transition={{ type: "spring", stiffness: 450, damping: 25 }}
              className={`relative w-full py-2.5 rounded-xl flex flex-col items-center justify-center gap-1 transition-colors duration-200 outline-none cursor-pointer ${
                isActive
                  ? "text-white font-semibold"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {/* ────────────────────────────────────────────────────────────
                  SLIDING LIQUID GLASS CAPSULE
                  A smooth continuous morph between tabs using layoutId
                  ──────────────────────────────────────────────────────────── */}
              {isActive && (
                <motion.div
                  layoutId="active-nav-capsule"
                  className="absolute inset-0 rounded-xl bg-white/[0.09] border border-white/20 shadow-[0_0_14px_rgba(255,255,255,0.08)] backdrop-blur-md z-0"
                  transition={{
                    type: "spring",
                    stiffness: 380,
                    damping: 26,
                    mass: 0.7,
                  }}
                >
                  {/* Subtle inner top-edge gloss shimmer */}
                  <div className="absolute inset-x-2 top-0.5 h-[1px] bg-gradient-to-r from-transparent via-white/30 to-transparent" />
                </motion.div>
              )}

              {/* Tab Icon with Elastic Spring & Subtle Glow on Active */}
              <div className="relative z-10 flex items-center justify-center">
                <motion.div
                  animate={
                    isActive
                      ? {
                          scale: [1, 1.15, 1],
                        }
                      : { scale: 1 }
                  }
                  transition={{
                    type: "spring",
                    stiffness: 420,
                    damping: 22,
                  }}
                >
                  <Icon
                    className={`w-4 h-4 transition-all duration-300 ${
                      isActive
                        ? "text-white drop-shadow-[0_0_6px_rgba(255,255,255,0.5)]"
                        : "text-zinc-400 group-hover:text-zinc-200"
                    }`}
                  />
                </motion.div>
              </div>

              {/* Tab Label */}
              <span
                className={`relative z-10 text-[9px] tracking-tight leading-none transition-colors duration-200 ${
                  isActive ? "text-white font-bold" : "text-zinc-500"
                }`}
              >
                {tab.label}
              </span>
            </motion.button>
          );
        })}
      </div>
    </motion.nav>
  );
};
