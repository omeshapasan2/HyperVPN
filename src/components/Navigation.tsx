import React from "react";
import { Server, BarChart3, CheckCircle2, Sliders, Terminal } from "lucide-react";

export type TabType = "configs" | "usage" | "verify" | "settings" | "logs";

interface NavigationProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}

export const Navigation: React.FC<NavigationProps> = ({ activeTab, onTabChange }) => {
  const tabs = [
    { id: "configs" as TabType, label: "Configs", icon: Server },
    { id: "usage" as TabType, label: "Data Usage", icon: BarChart3 },
    { id: "verify" as TabType, label: "Verify VPN", icon: CheckCircle2 },
    { id: "settings" as TabType, label: "Settings", icon: Sliders },
    { id: "logs" as TabType, label: "Logs", icon: Terminal },
  ];

  return (
    <nav className="bg-[#111827]/70 border-b border-gray-800/80 px-6 py-2 flex items-center gap-1.5 shrink-0 overflow-x-auto">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all duration-200 select-none whitespace-nowrap ${
              isActive
                ? "bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 shadow-sm shadow-indigo-950"
                : "text-gray-400 hover:text-gray-200 hover:bg-gray-800/60 border border-transparent"
            }`}
          >
            <Icon className={`w-4 h-4 ${isActive ? "text-indigo-400" : "text-gray-400"}`} />
            <span>{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
};
