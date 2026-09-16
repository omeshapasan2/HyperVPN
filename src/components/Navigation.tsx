import React from "react";
import { Server, BarChart3, Gauge, ShieldCheck, Sliders, Terminal } from "lucide-react";

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

  return (
    <nav className="w-14 bg-zinc-950/90 border-r border-zinc-800/80 flex flex-col items-center py-3 gap-2 shrink-0 select-none z-20">
      {/* Brand Icon / Logo */}
      <div className="w-9 h-9 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-100 mb-2 shadow-sm overflow-hidden p-1">
        <img src="/icons/hyper.png" alt="HyperVPN" className="w-full h-full object-contain rounded-lg" />
      </div>

      {/* Nav items */}
      <div className="flex-1 flex flex-col items-center gap-1.5 w-full px-1.5">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              title={tab.label}
              className={`w-full py-2.5 rounded-xl flex flex-col items-center justify-center gap-1 transition-all duration-150 relative ${
                isActive
                  ? "bg-zinc-800 text-white font-semibold shadow-sm border border-zinc-700"
                  : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/60 border border-transparent"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="text-[9px] tracking-tight leading-none">{tab.label}</span>
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-white rounded-r-full" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
