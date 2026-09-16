import React, { useState } from "react";
import { AppSettings } from "../types/config";
import { BinariesStatus } from "../hooks/useSettings";
import {
  Sliders,
  CheckCircle2,
  XCircle,
  Save,
  RotateCw,
  Network,
  Plus,
  Trash2,
  Shield,
  Laptop,
} from "lucide-react";

interface SettingsTabProps {
  settings: AppSettings;
  binaries: BinariesStatus;
  onSaveSettings: (settings: AppSettings) => Promise<void>;
  onCheckBinaries: () => Promise<void>;
}

export const SettingsTab: React.FC<SettingsTabProps> = ({
  settings,
  binaries,
  onSaveSettings,
  onCheckBinaries,
}) => {
  const [formData, setFormData] = useState<AppSettings>(settings);
  const [newExclusion, setNewExclusion] = useState("");
  const [isSaved, setIsSaved] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSaveSettings(formData);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2500);
  };

  const handleAddExclusion = () => {
    if (!newExclusion.trim()) return;
    const cidr = newExclusion.trim();
    if (!formData.customLanExclusions.includes(cidr)) {
      setFormData({
        ...formData,
        customLanExclusions: [...formData.customLanExclusions, cidr],
      });
    }
    setNewExclusion("");
  };

  const handleRemoveExclusion = (index: number) => {
    const updated = formData.customLanExclusions.filter((_, i) => i !== index);
    setFormData({ ...formData, customLanExclusions: updated });
  };

  return (
    <div className="flex-1 flex flex-col p-6 overflow-y-auto space-y-6">
      {/* Tab Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Sliders className="w-5 h-5 text-indigo-400" />
            Application & Routing Settings
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Configure system startup behavior, local proxy ports, and custom LAN routing exclusions.
          </p>
        </div>

        <button
          type="submit"
          form="settings-form"
          className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-xl shadow-lg shadow-indigo-950 transition-all flex items-center gap-1.5"
        >
          <Save className="w-4 h-4" />
          {isSaved ? "Settings Saved!" : "Save Settings"}
        </button>
      </div>

      <form id="settings-form" onSubmit={handleSave} className="space-y-6">
        {/* Core Sidecar Binaries Status */}
        <div className="bg-gray-900/60 border border-gray-800/80 rounded-2xl p-5 shadow-lg space-y-4">
          <div className="flex items-center justify-between border-b border-gray-800/80 pb-3">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-indigo-400" />
              <h3 className="text-sm font-bold text-white">Sidecar Core Binaries</h3>
            </div>
            <button
              type="button"
              onClick={() => onCheckBinaries()}
              className="px-2.5 py-1 bg-gray-800 hover:bg-gray-700 text-gray-300 text-[11px] font-semibold rounded-lg transition-colors flex items-center gap-1"
            >
              <RotateCw className="w-3 h-3" />
              Check Status
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* xray.exe */}
            <div className="bg-gray-950 p-3.5 rounded-xl border border-gray-800 flex flex-col justify-between gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-white">xray.exe</span>
                {binaries.xrayFound ? (
                  <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-400 bg-emerald-950/40 border border-emerald-800/50 px-2 py-0.5 rounded-md">
                    <CheckCircle2 className="w-3 h-3" /> Ready
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-[10px] font-semibold text-rose-400 bg-rose-950/40 border border-rose-800/50 px-2 py-0.5 rounded-md">
                    <XCircle className="w-3 h-3" /> Missing
                  </span>
                )}
              </div>
              <p className="text-[10px] font-mono text-gray-500 truncate">
                {binaries.xrayPath || "Place in binaries/ or src-tauri/binaries/"}
              </p>
            </div>

            {/* tun2socks.exe */}
            <div className="bg-gray-950 p-3.5 rounded-xl border border-gray-800 flex flex-col justify-between gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-white">tun2socks.exe</span>
                {binaries.tun2socksFound ? (
                  <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-400 bg-emerald-950/40 border border-emerald-800/50 px-2 py-0.5 rounded-md">
                    <CheckCircle2 className="w-3 h-3" /> Ready
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-[10px] font-semibold text-rose-400 bg-rose-950/40 border border-rose-800/50 px-2 py-0.5 rounded-md">
                    <XCircle className="w-3 h-3" /> Missing
                  </span>
                )}
              </div>
              <p className="text-[10px] font-mono text-gray-500 truncate">
                {binaries.tun2socksPath || "Place in binaries/ or src-tauri/binaries/"}
              </p>
            </div>

            {/* wintun.dll */}
            <div className="bg-gray-950 p-3.5 rounded-xl border border-gray-800 flex flex-col justify-between gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-white">wintun.dll</span>
                {binaries.wintunFound ? (
                  <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-400 bg-emerald-950/40 border border-emerald-800/50 px-2 py-0.5 rounded-md">
                    <CheckCircle2 className="w-3 h-3" /> Ready
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-[10px] font-semibold text-rose-400 bg-rose-950/40 border border-rose-800/50 px-2 py-0.5 rounded-md">
                    <XCircle className="w-3 h-3" /> Missing
                  </span>
                )}
              </div>
              <p className="text-[10px] font-mono text-gray-500 truncate">
                {binaries.wintunPath || "Place in binaries/ or system folder"}
              </p>
            </div>
          </div>
        </div>

        {/* Windows System & Startup Behavior */}
        <div className="bg-gray-900/60 border border-gray-800/80 rounded-2xl p-5 shadow-lg space-y-4">
          <div className="flex items-center gap-2 border-b border-gray-800/80 pb-3">
            <Laptop className="w-4 h-4 text-indigo-400" />
            <h3 className="text-sm font-bold text-white">Windows System & Startup Behavior</h3>
          </div>

          <div className="space-y-3">
            {/* Auto Start */}
            <div className="flex items-center justify-between p-3 bg-gray-950/60 border border-gray-800/80 rounded-xl">
              <div>
                <div className="text-xs font-semibold text-white">Start with Windows</div>
                <div className="text-[11px] text-gray-400">
                  Automatically launch HyperVPN silently on system boot.
                </div>
              </div>
              <input
                type="checkbox"
                checked={formData.autoStart}
                onChange={(e) => setFormData({ ...formData, autoStart: e.target.checked })}
                className="w-4 h-4 rounded bg-gray-900 border-gray-700 text-indigo-600 focus:ring-indigo-500"
              />
            </div>

            {/* Auto Connect */}
            <div className="flex items-center justify-between p-3 bg-gray-950/60 border border-gray-800/80 rounded-xl">
              <div>
                <div className="text-xs font-semibold text-white">Auto-Connect on Launch</div>
                <div className="text-[11px] text-gray-400">
                  Automatically initiate VPN tunnel with the active server when HyperVPN starts.
                </div>
              </div>
              <input
                type="checkbox"
                checked={formData.autoConnectOnLaunch}
                onChange={(e) =>
                  setFormData({ ...formData, autoConnectOnLaunch: e.target.checked })
                }
                className="w-4 h-4 rounded bg-gray-900 border-gray-700 text-indigo-600 focus:ring-indigo-500"
              />
            </div>

            {/* Minimize to Tray */}
            <div className="flex items-center justify-between p-3 bg-gray-950/60 border border-gray-800/80 rounded-xl">
              <div>
                <div className="text-xs font-semibold text-white">Minimize to System Tray on Close</div>
                <div className="text-[11px] text-gray-400">
                  Clicking the window close (X) button minimizes the client to the system tray instead of quitting.
                </div>
              </div>
              <input
                type="checkbox"
                checked={formData.minimizeToTrayOnClose}
                onChange={(e) =>
                  setFormData({ ...formData, minimizeToTrayOnClose: e.target.checked })
                }
                className="w-4 h-4 rounded bg-gray-900 border-gray-700 text-indigo-600 focus:ring-indigo-500"
              />
            </div>
          </div>
        </div>

        {/* Local Proxy Ports */}
        <div className="bg-gray-900/60 border border-gray-800/80 rounded-2xl p-5 shadow-lg space-y-4">
          <div className="flex items-center gap-2 border-b border-gray-800/80 pb-3">
            <Network className="w-4 h-4 text-indigo-400" />
            <h3 className="text-sm font-bold text-white">Local Proxy & Stats Ports</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">
                Local SOCKS5 Inbound Port
              </label>
              <input
                type="number"
                min={1024}
                max={65535}
                value={formData.socksPort}
                onChange={(e) =>
                  setFormData({ ...formData, socksPort: parseInt(e.target.value) || 10808 })
                }
                className="w-full px-3 py-2 bg-gray-950 border border-gray-800 rounded-xl text-xs font-mono text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <span className="text-[10px] text-gray-500 mt-1 block">
                Default: 10808 (Bound to 127.0.0.1 for tun2socks packet bridge)
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">
                Xray Stats API Port (Dokodemo)
              </label>
              <input
                type="number"
                min={1024}
                max={65535}
                value={formData.statsPort}
                onChange={(e) =>
                  setFormData({ ...formData, statsPort: parseInt(e.target.value) || 10085 })
                }
                className="w-full px-3 py-2 bg-gray-950 border border-gray-800 rounded-xl text-xs font-mono text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <span className="text-[10px] text-gray-500 mt-1 block">
                Default: 10085 (Internal Dokodemo endpoint for StatsService queries)
              </span>
            </div>
          </div>
        </div>

        {/* Custom LAN & Local Subnet Exclusions */}
        <div className="bg-gray-900/60 border border-gray-800/80 rounded-2xl p-5 shadow-lg space-y-4">
          <div className="flex items-center justify-between border-b border-gray-800/80 pb-3">
            <div className="flex items-center gap-2">
              <Network className="w-4 h-4 text-indigo-400" />
              <h3 className="text-sm font-bold text-white">LAN & Subnet Exclusions</h3>
            </div>
          </div>

          <div className="text-xs text-gray-400 space-y-1">
            <p>
              The following standard private RFC1918 & loopback ranges are automatically excluded from the
              VPN tunnel and routed directly to your local gateway:
            </p>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {["127.0.0.0/8", "10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16", "169.254.0.0/16"].map(
                (subnet) => (
                  <span
                    key={subnet}
                    className="px-2 py-0.5 rounded-md bg-gray-950 text-gray-300 border border-gray-800 font-mono text-[11px]"
                  >
                    {subnet}
                  </span>
                )
              )}
            </div>
          </div>

          {/* Add custom exclusion */}
          <div className="space-y-2 pt-2">
            <label className="block text-xs font-semibold text-gray-300">
              Add Custom Subnet Exclusion (CIDR format)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newExclusion}
                onChange={(e) => setNewExclusion(e.target.value)}
                placeholder="e.g. 192.168.10.0/24 or 172.20.0.0/16"
                className="flex-1 px-3 py-2 bg-gray-950 border border-gray-800 rounded-xl text-xs font-mono text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <button
                type="button"
                onClick={handleAddExclusion}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white font-semibold text-xs rounded-xl transition-colors flex items-center gap-1.5 shrink-0"
              >
                <Plus className="w-3.5 h-3.5 text-indigo-400" />
                Add
              </button>
            </div>

            {/* List of custom exclusions */}
            {formData.customLanExclusions.length > 0 && (
              <div className="space-y-1.5 pt-2">
                {formData.customLanExclusions.map((cidr, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between px-3 py-1.5 bg-gray-950 rounded-xl border border-gray-800"
                  >
                    <span className="font-mono text-xs text-indigo-300">{cidr}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveExclusion(index)}
                      className="text-gray-500 hover:text-rose-400 p-1 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </form>
    </div>
  );
};
